<div align="center">
  <h1>ChatFoundry</h1>
  <h3>Your Sovereign AI Workspace</h3>
  
  [![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
  [![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/BhanuKorthiwada/ChatFoundry)
  [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)
</div>

## 🌟 Features

| Feature | Description |
|---------|-------------|
| 💬 **Multi-Model Chat** | Access multiple AI models (ChatGPT, Claude, Gemini, etc.) through a single interface |
| 🔑 **BYOK (Bring Your Own Keys)** | Use your own API keys - no subscriptions or middlemen |
| ☁️ **Serverless on Cloudflare** | Deploy as a single Cloudflare Worker with minimal setup |
| 🏦 **Cost-Effective** | Built to maximize Cloudflare's generous free tier |
| 🔒 **Privacy First** | Your data stays in your Cloudflare account |
| 🚀 **Open Source** | Apache 2.0 licensed - inspect, modify, and contribute |

## 📋 Table of Contents

- [🚀 Quick Start](#-quick-start)
  - [Prerequisites](#prerequisites)
  - [One-Click Deployment](#one-click-deployment)
  - [Supported AI Models](#supported-ai-models)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)

## 🚀 Quick Start

### Prerequisites

Before you begin, ensure you have:

1. A [Cloudflare account](https://dash.cloudflare.com/sign-up)
2. Cloudflare Workers enabled on your account
3. Required API keys:
   - [OpenAI API Key](https://platform.openai.com/api-keys)
   - [Google AI API Key](https://ai.google.dev/)
   - [Anthropic API Key](https://console.anthropic.com/settings/keys)

### One-Click Deployment

The fastest way to deploy ChatFoundry is using the Cloudflare button below:

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/BhanuKorthiwada/ChatFoundry)

This will:
1. Fork the repository to your GitHub account
2. Create a new Cloudflare Worker
3. Set up necessary Cloudflare services (Workers, R2, D1)
4. Guide you through the configuration process
5. Deploy the application to your Cloudflare account
6. Open the application in your browser
7. Configure keys from the Admin Dashboard

### Supported AI Models

| Provider | Model ID | Required API Key |
|----------|----------|------------------|
| OpenAI | gpt-4, gpt-4-turbo, gpt-3.5-turbo | `OPENAI_API_KEY` |
| Google AI | gemini-pro, gemini-1.5-pro | `GOOGLE_AI_KEY` |
| Anthropic | claude-3-opus, claude-3-sonnet | `ANTHROPIC_API_KEY` |

## 🤝 Contributing

We welcome contributions!

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

---

<div align="center">
  Made with ❤️
</div>