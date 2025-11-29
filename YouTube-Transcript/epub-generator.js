// EPUB 生成器 - 将 YouTube 字幕转换为 EPUB 电子书
// 支持目录和章节标题

class EpubGenerator {
    constructor() {
        this.uuid = this.generateUUID();
    }

    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    formatTime(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        if (h > 0) {
            return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        }
        return `${m}:${String(s).padStart(2, '0')}`;
    }

    escapeXml(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // 将字幕按章节分组
    groupTranscriptByChapters(transcriptData, chapters) {
        if (!chapters || chapters.length === 0) {
            // 没有章节，创建一个默认章节
            return [{
                title: '全文',
                start: 0,
                segments: transcriptData
            }];
        }

        const grouped = [];
        let currentChapterIndex = 0;

        for (let i = 0; i < chapters.length; i++) {
            const chapter = chapters[i];
            const nextChapter = chapters[i + 1];
            const chapterEnd = nextChapter ? nextChapter.start : Infinity;

            const segments = transcriptData.filter(seg => 
                seg.start >= chapter.start && seg.start < chapterEnd
            );

            grouped.push({
                title: chapter.title || `章节 ${i + 1}`,
                start: chapter.start,
                segments: segments
            });
        }

        return grouped.filter(ch => ch.segments.length > 0);
    }

    // 生成 mimetype 文件
    generateMimetype() {
        return 'application/epub+zip';
    }

    // 生成 container.xml
    generateContainer() {
        return `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
    }

    // 生成 content.opf
    generateContentOpf(title, author, chapters) {
        const now = new Date().toISOString();
        const manifestItems = chapters.map((ch, i) => 
            `    <item id="chapter${i + 1}" href="chapter${i + 1}.xhtml" media-type="application/xhtml+xml"/>`
        ).join('\n');

        const spineItems = chapters.map((ch, i) => 
            `    <itemref idref="chapter${i + 1}"/>`
        ).join('\n');

        return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uid">urn:uuid:${this.uuid}</dc:identifier>
    <dc:title>${this.escapeXml(title)}</dc:title>
    <dc:creator>${this.escapeXml(author)}</dc:creator>
    <dc:language>zh-CN</dc:language>
    <dc:date>${now}</dc:date>
    <meta property="dcterms:modified">${now.split('.')[0]}Z</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="css" href="style.css" media-type="text/css"/>
${manifestItems}
  </manifest>
  <spine toc="ncx">
${spineItems}
  </spine>
</package>`;
    }

    // 生成 toc.ncx (目录)
    generateTocNcx(title, chapters) {
        const navPoints = chapters.map((ch, i) => `
    <navPoint id="navpoint${i + 1}" playOrder="${i + 1}">
      <navLabel>
        <text>${this.escapeXml(ch.title)}</text>
      </navLabel>
      <content src="chapter${i + 1}.xhtml"/>
    </navPoint>`).join('');

        return `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="urn:uuid:${this.uuid}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle>
    <text>${this.escapeXml(title)}</text>
  </docTitle>
  <navMap>${navPoints}
  </navMap>
</ncx>`;
    }

    // 生成 nav.xhtml (HTML5 目录)
    generateNav(title, chapters) {
        const navItems = chapters.map((ch, i) => 
            `        <li><a href="chapter${i + 1}.xhtml">${this.escapeXml(ch.title)}</a></li>`
        ).join('\n');

        return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <meta charset="UTF-8"/>
  <title>目录</title>
  <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>目录</h1>
    <ol>
${navItems}
    </ol>
  </nav>
</body>
</html>`;
    }

    // 生成 CSS 样式
    generateStyle() {
        return `/* EPUB 样式 */
body {
  font-family: "PingFang SC", "Microsoft YaHei", "Hiragino Sans GB", sans-serif;
  line-height: 1.8;
  margin: 1em;
  padding: 0;
  color: #333;
  background: #fff;
}

h1 {
  font-size: 1.5em;
  color: #1a1a1a;
  margin-bottom: 1em;
  padding-bottom: 0.5em;
  border-bottom: 2px solid #3b82f6;
}

h2 {
  font-size: 1.3em;
  color: #1f2937;
  margin-top: 1.5em;
  margin-bottom: 0.5em;
}

p {
  margin: 0.5em 0;
  text-align: justify;
}

.timestamp {
  color: #6b7280;
  font-size: 0.85em;
  font-family: monospace;
  margin-right: 0.5em;
}

.segment {
  margin: 0.3em 0;
  padding: 0.2em 0;
}

.chapter-header {
  margin-top: 2em;
  margin-bottom: 1em;
}

.chapter-time {
  color: #3b82f6;
  font-size: 0.9em;
  font-weight: normal;
}

nav#toc ol {
  list-style-type: decimal;
  padding-left: 1.5em;
}

nav#toc li {
  margin: 0.5em 0;
}

nav#toc a {
  color: #3b82f6;
  text-decoration: none;
}

nav#toc a:hover {
  text-decoration: underline;
}
`;
    }

    // 生成章节内容 XHTML
    generateChapter(chapter, index) {
        const segmentsHtml = chapter.segments.map(seg => {
            const time = this.formatTime(seg.start);
            const text = this.escapeXml(seg.text);
            return `    <p class="segment"><span class="timestamp">[${time}]</span> ${text}</p>`;
        }).join('\n');

        return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8"/>
  <title>${this.escapeXml(chapter.title)}</title>
  <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
  <div class="chapter-header">
    <h1>${this.escapeXml(chapter.title)} <span class="chapter-time">[${this.formatTime(chapter.start)}]</span></h1>
  </div>
  <div class="chapter-content">
${segmentsHtml}
  </div>
</body>
</html>`;
    }

    // 使用 JSZip 生成 EPUB (在浏览器中使用)
    async generateEpubBlob(title, author, transcriptData, chapters) {
        // JSZip 已通过 manifest.json 预加载
        if (typeof JSZip === 'undefined') {
            throw new Error('JSZip 库未加载，请刷新页面重试');
        }

        const zip = new JSZip();
        
        // 分组字幕数据
        const groupedChapters = this.groupTranscriptByChapters(transcriptData, chapters);

        // 添加 mimetype (必须是第一个文件，且不压缩)
        zip.file('mimetype', this.generateMimetype(), { compression: 'STORE' });

        // 添加 META-INF/container.xml
        zip.file('META-INF/container.xml', this.generateContainer());

        // 添加 OEBPS 内容
        zip.file('OEBPS/content.opf', this.generateContentOpf(title, author, groupedChapters));
        zip.file('OEBPS/toc.ncx', this.generateTocNcx(title, groupedChapters));
        zip.file('OEBPS/nav.xhtml', this.generateNav(title, groupedChapters));
        zip.file('OEBPS/style.css', this.generateStyle());

        // 添加各章节
        groupedChapters.forEach((chapter, index) => {
            zip.file(`OEBPS/chapter${index + 1}.xhtml`, this.generateChapter(chapter, index));
        });

        // 生成 blob
        const blob = await zip.generateAsync({
            type: 'blob',
            mimeType: 'application/epub+zip',
            compression: 'DEFLATE',
            compressionOptions: { level: 9 }
        });

        return blob;
    }

    // 下载 EPUB 文件
    async downloadEpub(title, author, transcriptData, chapters) {
        try {
            console.log('[EPUB Generator] 开始生成 EPUB...');
            console.log('[EPUB Generator] 字幕数量:', transcriptData.length);
            console.log('[EPUB Generator] 章节数量:', chapters.length);

            const blob = await this.generateEpubBlob(title, author, transcriptData, chapters);
            
            // 创建下载链接
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${title.replace(/[\\/*?:"|<>]/g, '_')}.epub`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            console.log('[EPUB Generator] EPUB 下载完成');
            return true;
        } catch (error) {
            console.error('[EPUB Generator] 生成 EPUB 失败:', error);
            throw error;
        }
    }
}

// 导出全局实例
window.epubGenerator = new EpubGenerator();

// 辅助函数：从页面获取视频标题
function getVideoTitle() {
    const titleElement = document.querySelector('h1.ytd-video-primary-info-renderer yt-formatted-string') ||
                        document.querySelector('h1.title yt-formatted-string') ||
                        document.querySelector('#title h1 yt-formatted-string') ||
                        document.querySelector('h1.ytd-watch-metadata yt-formatted-string');
    if (titleElement) {
        return titleElement.textContent.trim();
    }
    // 备用：从页面标题提取
    const pageTitle = document.title.replace(' - YouTube', '').trim();
    return pageTitle || 'YouTube 视频字幕';
}

// 辅助函数：获取频道名称作为作者
function getChannelName() {
    const channelElement = document.querySelector('#channel-name a') ||
                          document.querySelector('ytd-channel-name a') ||
                          document.querySelector('.ytd-video-owner-renderer #text a');
    if (channelElement) {
        return channelElement.textContent.trim();
    }
    return 'YouTube';
}

// 主下载函数 - 在 content-dom.js 中调用
async function downloadTranscriptAsEpub() {
    const btn = document.getElementById('download-epub');
    
    if (!window.epubGenerator) {
        console.error('[EPUB] EPUB 生成器未加载');
        alert('EPUB 生成器未加载，请刷新页面重试');
        return;
    }

    // 获取全局的 transcriptData 和 chapters
    if (typeof transcriptData === 'undefined' || transcriptData.length === 0) {
        alert('没有字幕数据，请先等待字幕加载完成');
        return;
    }

    const title = getVideoTitle();
    const author = getChannelName();
    const chaptersToUse = typeof chapters !== 'undefined' ? chapters : [];

    // 显示加载状态
    if (btn) {
        btn.classList.add('loading');
        btn.textContent = '⏳';
        btn.disabled = true;
    }

    try {
        await window.epubGenerator.downloadEpub(title, author, transcriptData, chaptersToUse);
        console.log('[EPUB] 下载成功');
        
        // 显示成功状态
        if (btn) {
            btn.textContent = '✅';
            setTimeout(() => {
                btn.textContent = '📚';
                btn.classList.remove('loading');
                btn.disabled = false;
            }, 2000);
        }
    } catch (error) {
        console.error('[EPUB] 下载失败:', error);
        alert('EPUB 生成失败: ' + error.message);
        
        // 恢复按钮状态
        if (btn) {
            btn.textContent = '📚';
            btn.classList.remove('loading');
            btn.disabled = false;
        }
    }
}

console.log('[EPUB Generator] 模块已加载');
