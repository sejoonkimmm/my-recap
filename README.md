# my-recap

A tool that automatically generates performance summaries by analyzing Linear issues and markdown documents.

## Features

- **Linear Integration**: Fetches completed issues for a selected period
- **Clickable Issues**: Each issue links directly to its Linear ticket page
- **Markdown Upload**: Drag & drop .md files to include additional performance docs
- **AI Summary**: Uses Gemini 3 Flash to generate professional performance summaries
- **Copy to Clipboard**: One-click copy for the generated summary

## Tech Stack

- Vite
- Vanilla JS
- Tailwind CSS (CDN)
- Google Generative AI SDK

## Setup

```bash
npm install
```

## Usage

```bash
npm run dev
```

## Environment Variables

Create a `.env` file in the project root:

```
VITE_LINEAR_API_KEY=your_linear_api_key
VITE_GEMINI_API_KEY=your_gemini_api_key
```
