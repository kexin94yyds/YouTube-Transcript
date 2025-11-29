// Vercel serverless implementation of the "切书神技" workflow using pure Node.js.
// No external CLI tools (pandoc/unzip) are required.

import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import formidable from 'formidable';
import AdmZip from 'adm-zip';
import TurndownService from 'turndown';
import { htmlToText } from 'html-to-text';
import { parseStringPromise } from 'xml2js';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { Readable } from 'stream';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TMP_ROOT = '/tmp/book-cutting';
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const ensureDir = (dir) => fs.mkdirSync(dir, { recursive: true });
const safeUnlink = (filePath) => {
  try { fs.unlinkSync(filePath); } catch (_) {}
};

const readJsonBody = (req) => new Promise((resolve, reject) => {
  let data = '';
  req.on('data', (chunk) => { data += chunk; });
  req.on('end', () => {
    try {
      resolve(data ? JSON.parse(data) : {});
    } catch (err) {
      reject(err);
    }
  });
  req.on('error', reject);
});

const sanitizeTitle = (title) => {
  if (!title) return 'untitled';
  let cleaned = title
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[\\/*?:"|<>]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_');
  if (!cleaned) cleaned = 'untitled';
  if (cleaned.length > 60) cleaned = cleaned.slice(0, 60);
  return cleaned;
};

const encodeRFC5987 = (str) =>
  encodeURIComponent(str)
    .replace(/['()]/g, escape)
    .replace(/\*/g, '%2A')
    .replace(/%(7C|60|5E)/g, '%$1');

const idxLabel = (i) => String(i + 1).padStart(3, '0');

const parseMultipart = (req) => {
  const uploadDir = path.join(TMP_ROOT, 'uploads');
  ensureDir(uploadDir);
  const form = formidable({
    multiples: false,
    uploadDir,
    keepExtensions: true,
    maxFileSize: MAX_FILE_SIZE,
  });

  return new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => {
      if (err) return reject(err);
      const file = Array.isArray(files.file) ? files.file[0] : files.file;
      if (!file) return reject(new Error('没有上传文件'));
      resolve({
        filePath: file.filepath || file.path,
        originalName: file.originalFilename || file.name || 'book.epub',
      });
    });
  });
};

const downloadFromBlob = async (blobUrl) => {
  const res = await fetch(blobUrl);
  if (!res.ok) throw new Error(`拉取上传文件失败：${res.status}`);
  const tmpPath = path.join(TMP_ROOT, `${randomUUID()}.epub`);
  ensureDir(TMP_ROOT);
  const nodeStream = Readable.fromWeb(res.body);
  await new Promise((resolve, reject) => {
    const out = fs.createWriteStream(tmpPath);
    nodeStream.on('error', reject);
    out.on('error', reject);
    out.on('finish', resolve);
    nodeStream.pipe(out);
  });
  return tmpPath;
};

const findOpfPath = async (extractDir) => {
  const containerPath = path.join(extractDir, 'META-INF', 'container.xml');
  if (fs.existsSync(containerPath)) {
    const xml = await fs.promises.readFile(containerPath, 'utf8');
    const match = xml.match(/full-path="([^"]+)"/i);
    if (match && match[1]) {
      const opfPath = path.join(extractDir, match[1]);
      if (fs.existsSync(opfPath)) return opfPath;
    }
  }
  const stack = [extractDir];
  while (stack.length) {
    const dir = stack.pop();
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith('.opf')) return full;
    }
  }
  return null;
};

const orderedHtmlFromOpf = async (opfPath) => {
  try {
    const xml = await fs.promises.readFile(opfPath, 'utf8');
    const parsed = await parseStringPromise(xml);
    const manifestItems = parsed?.package?.manifest?.[0]?.item || [];
    const spineRefs = parsed?.package?.spine?.[0]?.itemref || [];
    const idToHref = {};
    manifestItems.forEach((item) => {
      const id = item?.$?.id;
      const href = item?.$?.href;
      if (id && href) idToHref[id] = href;
    });
    const baseDir = path.dirname(opfPath);
    const ordered = spineRefs
      .map((ref) => idToHref[ref?.$?.idref])
      .filter(Boolean)
      .map((href) => path.normalize(path.join(baseDir, href)));
    return ordered;
  } catch (err) {
    console.warn('OPF parse failed, fallback to file scan:', err.message);
    return [];
  }
};

const scanHtmlFiles = async (rootDir) => {
  const results = [];
  const stack = [rootDir];
  while (stack.length) {
    const dir = stack.pop();
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile()) {
        const lower = entry.name.toLowerCase();
        if (lower.endsWith('.html') || lower.endsWith('.xhtml')) results.push(full);
      }
    }
  }
  return results.sort();
};

const extractTitleFromHtml = (html, fallback, index) => {
  const text = htmlToText(html, { wordwrap: false, preserveNewlines: true });
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .slice(0, 12);
  const patterns = [
    /^[0-9]+\s+.+/,
    /^第[一二三四五六七八九十百千万甲乙丙丁戊己庚辛壬癸]+[章节回].+/,
    /^Chapter\s+.+/i,
    /^目录/,
    /^序言/,
    /^前言/,
    /^后记/,
    /^附录/,
  ];
  for (const line of lines) {
    if (patterns.some((re) => re.test(line))) return sanitizeTitle(line);
  }
  if (lines.length) return sanitizeTitle(lines[0]);
  const fallbackTitle = fallback || `chapter_${idxLabel(index)}`;
  return sanitizeTitle(fallbackTitle);
};

const buildOutputs = async (htmlFiles, extractDir, outputDir, bookBaseName) => {
  const mdDir = path.join(outputDir, 'markdown');
  const txtDir = path.join(outputDir, 'txt');
  ensureDir(mdDir);
  ensureDir(txtDir);

  const turndown = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    emDelimiter: '*',
    strongDelimiter: '**',
  });

  const chapters = [];
  for (let i = 0; i < htmlFiles.length; i++) {
    const htmlPath = htmlFiles[i];
    const html = await fs.promises.readFile(htmlPath, 'utf8');
    const title = extractTitleFromHtml(html, path.basename(htmlPath), i);
    const base = `${idxLabel(i)}_${title}`;

    const mdContent = turndown.turndown(html);
    const txtContent = htmlToText(html, { wordwrap: false, preserveNewlines: false });

    const mdFile = path.join(mdDir, `${base}.md`);
    const txtFile = path.join(txtDir, `${base}.txt`);
    await fs.promises.writeFile(mdFile, mdContent, 'utf8');
    await fs.promises.writeFile(txtFile, txtContent, 'utf8');

    chapters.push({ index: i + 1, title, mdFile, txtFile, relMd: `markdown/${base}.md`, relTxt: `txt/${base}.txt` });
  }

  // Combined markdown with simple front matter
  const combinedMdParts = [
    '---',
    `title: "${bookBaseName}"`,
    `date: ${new Date().toISOString()}`,
    '---',
    '',
  ];
  chapters.forEach((ch) => {
    combinedMdParts.push(`## ${idxLabel(ch.index - 1)} ${ch.title}`, fs.readFileSync(ch.mdFile, 'utf8'), '\n---\n');
  });
  await fs.promises.writeFile(path.join(outputDir, `${bookBaseName}.md`), combinedMdParts.join('\n'), 'utf8');

  // Combined TXT
  const combinedTxtParts = [`${bookBaseName}`, '==============================', ''];
  chapters.forEach((ch) => {
    combinedTxtParts.push(`## ${ch.title}`, '--------------------------------', fs.readFileSync(ch.txtFile, 'utf8'), '\n');
  });
  await fs.promises.writeFile(path.join(outputDir, `${bookBaseName}.txt`), combinedTxtParts.join('\n'), 'utf8');

  // Index files
  const mdIndex = chapters.map((ch) => `- [${ch.title}](${ch.relMd})`).join('\n');
  const txtIndex = chapters.map((ch) => `* ${idxLabel(ch.index - 1)} ${ch.title}`).join('\n');
  await fs.promises.writeFile(path.join(mdDir, 'index.md'), `# ${bookBaseName}\n\n## 目录\n\n${mdIndex}\n`, 'utf8');
  await fs.promises.writeFile(path.join(txtDir, 'index.txt'), `目录\n======\n\n${txtIndex}\n`, 'utf8');

  return { chapters };
};

const processEpub = async (epubPath, originalName) => {
  const jobId = randomUUID();
  const workDir = path.join(TMP_ROOT, jobId);
  const extractDir = path.join(workDir, 'extracted');
  const bookBaseName = sanitizeTitle(path.basename(originalName, path.extname(originalName)).replace(/^[0-9]+-/, ''));
  const outputDir = path.join(workDir, bookBaseName);
  ensureDir(extractDir);
  ensureDir(outputDir);

  // Extract EPUB (zip) contents
  const zip = new AdmZip(epubPath);
  zip.extractAllTo(extractDir, true);

  // Copy raw HTML/content for reference
  try {
    await fs.promises.cp(extractDir, path.join(outputDir, 'html'), { recursive: true });
  } catch (err) {
    console.warn('Failed to copy raw HTML:', err.message);
  }

  // Resolve spine-ordered HTML/XHTML list
  let htmlFiles = [];
  const opfPath = await findOpfPath(extractDir);
  if (opfPath) {
    const ordered = await orderedHtmlFromOpf(opfPath);
    htmlFiles = ordered.filter((p) => fs.existsSync(p) && (p.endsWith('.html') || p.endsWith('.xhtml')));
  }
  if (!htmlFiles.length) {
    htmlFiles = await scanHtmlFiles(extractDir);
  }
  if (!htmlFiles.length) {
    throw new Error('EPUB 内未找到可用的 HTML/XHTML 内容');
  }

  const { chapters } = await buildOutputs(htmlFiles, extractDir, outputDir, bookBaseName);

  return {
    success: true,
    outputDir,
    jobId,
    chapters: chapters.map((c) => ({ index: c.index, title: c.title, md: c.relMd, txt: c.relTxt })),
  };
};

const handleUpload = async (req, res) => {
  try {
    const contentType = req.headers['content-type'] || '';
    let filePath;
    let originalName = 'book.epub';

    if (contentType.includes('application/json')) {
      const body = await readJsonBody(req);
      if (!body?.blobUrl) {
        return res.status(400).json({ success: false, error: '缺少 blobUrl' });
      }
      filePath = await downloadFromBlob(body.blobUrl);
      originalName = body.filename || originalName;
    } else {
      const parsed = await parseMultipart(req);
      filePath = parsed.filePath;
      originalName = parsed.originalName || originalName;
    }

    const result = await processEpub(filePath, originalName);
    safeUnlink(filePath);
    return res.status(200).json({
      success: true,
      message: '切书完成',
      outputDir: result.outputDir,
      jobId: result.jobId,
      chapters: result.chapters,
    });
  } catch (err) {
    console.error('Upload error:', err);
    return res.status(500).json({ success: false, error: err.message || '处理失败' });
  }
};

const handleDownload = async (req, res) => {
  const pathParam = req.query?.path || req.query?.outputDir || '';
  const decoded = decodeURIComponent(pathParam);
  if (!decoded) {
    return res.status(400).json({ success: false, error: '缺少路径参数' });
  }
  if (!decoded.startsWith(TMP_ROOT)) {
    return res.status(400).json({ success: false, error: '非法路径' });
  }
  if (!fs.existsSync(decoded)) {
    return res.status(404).json({ success: false, error: '文件不存在' });
  }

  const outputBase = path.basename(decoded) || 'book';
  const safeName = outputBase.replace(/[^\w.-]/g, '_') || 'book';
  const zipFileName = `${safeName}.zip`;
  const zipPath = path.join('/tmp', `${randomUUID()}.zip`);

  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${zipFileName}"; filename*=UTF-8''${encodeRFC5987(`${outputBase}.zip`)}`
      );
      const stream = fs.createReadStream(zipPath);
      stream.on('close', () => {
        safeUnlink(zipPath);
        resolve();
      });
      stream.pipe(res);
    });

    archive.on('error', (err) => {
      console.error('Archive error:', err);
      res.status(500).json({ success: false, error: '打包失败' });
      reject(err);
    });

    archive.pipe(output);
    archive.directory(decoded, false);
    archive.finalize();
  });
};

const handleCleanup = async (req, res) => {
  const jobId = req.query?.jobId;
  if (!jobId) return res.status(400).json({ success: false, error: '缺少 jobId' });
  const target = path.join(TMP_ROOT, jobId);
  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true });
  }
  return res.status(200).json({ success: true, message: '已清理' });
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Content-Length, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const pathname = req.url || '';
  console.log(`[Handler] ${req.method} ${pathname}`);

  try {
    if (req.method === 'POST' && (pathname.includes('/upload') || pathname === '/api/book-cutting' || pathname === '/')) {
      return await handleUpload(req, res);
    }
    if (req.method === 'GET' && pathname.includes('/download')) {
      return await handleDownload(req, res);
    }
    if (req.method === 'GET' && pathname.includes('/cleanup')) {
      return await handleCleanup(req, res);
    }
    if (req.method === 'GET') {
      return res.status(200).json({
        success: true,
        message: 'Book Cutting API is running',
        endpoints: {
          upload: 'POST /api/book-cutting/upload',
          download: 'GET /api/book-cutting/download?path=...',
          cleanup: 'GET /api/book-cutting/cleanup?jobId=...',
        },
      });
    }
    return res.status(404).json({ success: false, error: 'Not found', pathname });
  } catch (error) {
    console.error('Handler error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Server error' });
  }
}
