# ToBooks - Private Key Authentication & EPUB Reader System

A secure web-based EPUB reader with private key authentication system, featuring WeChat Pay integration and SMS verification.

## 🚀 Features

### Authentication System
- **RSA Private Key Authentication**: Secure login using RSA-2048 private keys
- **Digital Signature Verification**: SHA256withRSA signature validation
- **Multi-Key Support**: Support for up to 10 different key pairs
- **Debug Tools**: Built-in signature debugging and verification tools

### EPUB Reader
- **Full EPUB Support**: Read EPUB files with complete formatting
- **Full-Text Search**: Search across entire book content
- **Bookmarks & Notes**: Save reading progress and annotations
- **Responsive Design**: Works on desktop and mobile devices
- **Multiple Themes**: Light and dark reading modes

### Payment Integration
- **WeChat Pay**: Integrated payment system for premium features
- **SMS Verification**: Phone number verification for account security
- **Premium Features**: Unlock advanced reading features

## 🛠️ Installation

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Setup
1. Clone the repository:
```bash
git clone https://github.com/kexin94yyds/tobooks.git
cd tobooks
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env.local
# Edit .env.local with your configuration
```

4. Generate RSA key pairs (optional):
```bash
node generate_10_keys.js
```

5. Start the server:
```bash
node server.js
```

6. Access the application:
- Authentication Demo: http://localhost:3000/auth-demo
- EPUB Reader: http://localhost:3000/tobooks-main
- Debug Tools: http://localhost:3000/debug-signature.html

## 🔐 Authentication Flow

1. **Key Generation**: Generate RSA-2048 key pairs using the provided scripts
2. **Private Key Input**: Users paste their private key into the authentication form
3. **Message Signing**: System signs a verification message using the private key
4. **Server Verification**: Server validates the signature against stored public keys
5. **Access Granted**: Successful authentication redirects to the EPUB reader

## 📁 Project Structure

```
tobooks/
├── api/                    # API endpoints
│   ├── authenticate.js     # Authentication logic
│   ├── payment.js         # Payment processing
│   ├── sms.js            # SMS verification
│   └── wechat-pay.js     # WeChat Pay integration
├── auth-demo/             # Authentication interface
│   ├── index.html        # Login page
│   ├── css/styles.css    # Styling
│   └── js/auth.js        # Client-side auth logic
├── tobooks-main/          # EPUB reader application
│   ├── index.html        # Reader interface
│   └── lib/              # Reader libraries
├── keys/                  # RSA key storage
│   ├── public_*.pem      # Public keys (1-10)
│   └── private_*.pem     # Private keys (gitignored)
├── config/               # Configuration files
├── dist/                 # Distribution packages
└── server.js            # Main server file
```

## 🔧 Configuration

### Environment Variables (.env.local)
```env
# Server Configuration
PORT=3000
NODE_ENV=development

# WeChat Pay Configuration
WECHAT_APPID=your_app_id
WECHAT_MCHID=your_merchant_id
WECHAT_API_KEY=your_api_key

# SMS Configuration
SMS_API_KEY=your_sms_api_key
SMS_SECRET=your_sms_secret
```

### WeChat Pay Setup
See [WECHAT_PAY_SETUP.md](WECHAT_PAY_SETUP.md) for detailed WeChat Pay configuration instructions.

## 🧪 Testing & Debugging

### Debug Signature Tool
Access the signature debugging tool at `/debug-signature.html` to:
- Test private key signature generation
- Compare JavaScript vs OpenSSL signatures
- Verify server-side signature validation
- Debug authentication issues

### Key Generation
Generate new key pairs for testing:
```bash
# Generate a single key pair
node generate_keys.js

# Generate 10 key pairs
node generate_10_keys.js

# Package keys for distribution
node package_keys.js
```

## 🔒 Security Features

- **RSA-2048 Encryption**: Industry-standard key length
- **Secure Key Storage**: Private keys are gitignored and never stored on server
- **Signature Validation**: Cryptographic proof of key ownership
- **HTTPS Ready**: Designed for secure HTTPS deployment
- **Input Validation**: Comprehensive input sanitization
- **Error Handling**: Secure error messages without information leakage

## 📱 Mobile Support

The application is fully responsive and works on:
- Desktop browsers (Chrome, Firefox, Safari, Edge)
- Mobile browsers (iOS Safari, Android Chrome)
- Tablet devices

## 🚀 Deployment

### Production Deployment
1. Set `NODE_ENV=production` in your environment
2. Configure HTTPS certificates
3. Set up reverse proxy (nginx recommended)
4. Configure firewall rules
5. Set up monitoring and logging

### Docker Deployment (Optional)
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue on GitHub
- Check the debug tools for authentication problems
- Review the server logs for detailed error information

## 🔄 Version History

- **v1.0.0**: Initial release with basic authentication and EPUB reader
- **v1.1.0**: Added WeChat Pay integration and SMS verification
- **v1.2.0**: Enhanced debugging tools and multi-key support
- **v1.3.0**: Improved mobile responsiveness and security features

---

Built with ❤️ for secure document reading and authentication.