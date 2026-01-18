import { GoogleGenerativeAI } from '@google/generative-ai';

const LINEAR_API_KEY = import.meta.env.VITE_LINEAR_API_KEY || '';
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

let linearIssues = [];
let uploadedDocs = [];

function setDefaultDates() {
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);
  
  document.getElementById('endDate').value = today.toISOString().split('T')[0];
  document.getElementById('startDate').value = thirtyDaysAgo.toISOString().split('T')[0];
}

function showLoading(text = 'Loading...') {
  document.getElementById('loadingText').textContent = text;
  document.getElementById('loading').classList.remove('hidden');
}

function hideLoading() {
  document.getElementById('loading').classList.add('hidden');
}

async function fetchLinearIssues() {
  const startDate = document.getElementById('startDate').value;
  const endDate = document.getElementById('endDate').value;
  
  if (!startDate || !endDate) {
    alert('Please select a period');
    return;
  }
  
  showLoading('Fetching Linear issues...');
  
  const query = `
    query {
      viewer {
        assignedIssues(
          filter: {
            completedAt: {
              gte: "${startDate}T00:00:00Z",
              lte: "${endDate}T23:59:59Z"
            }
          }
        ) {
          nodes {
            id
            identifier
            title
            description
            completedAt
            url
            state {
              name
            }
            project {
              name
            }
            team {
              key
            }
            labels {
              nodes {
                name
              }
            }
          }
        }
      }
    }
  `;
  
  try {
    const response = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': LINEAR_API_KEY,
      },
      body: JSON.stringify({ query }),
    });
    
    const data = await response.json();
    
    if (data.errors) {
      throw new Error(data.errors[0].message);
    }
    
    linearIssues = data.data.viewer.assignedIssues.nodes;
    renderLinearIssues();
  } catch (error) {
    console.error('Linear API Error:', error);
    document.getElementById('linearIssues').innerHTML = `
      <div class="text-red-500">Error: ${error.message}</div>
    `;
  } finally {
    hideLoading();
  }
}

function renderLinearIssues() {
  const container = document.getElementById('linearIssues');
  
  if (linearIssues.length === 0) {
    container.innerHTML = '<div class="text-gray-500">No completed issues found for this period.</div>';
    return;
  }
  
  container.innerHTML = linearIssues.map(issue => `
    <a href="${issue.url}" target="_blank" rel="noopener noreferrer" 
       class="issue-link block bg-white p-3 rounded-lg mb-2 border border-gray-200 transition-colors cursor-pointer">
      <div class="flex items-center gap-2">
        <span class="text-xs font-mono text-purple-600 bg-purple-50 px-2 py-0.5 rounded">${issue.identifier}</span>
        <span class="font-medium text-gray-800 flex-1">${issue.title}</span>
        <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
        </svg>
      </div>
      <div class="text-xs text-gray-500 mt-1">
        ${issue.project?.name || 'No project'} · ${new Date(issue.completedAt).toLocaleDateString('en-US')}
        ${issue.labels.nodes.length > 0 ? ' · ' + issue.labels.nodes.map(l => l.name).join(', ') : ''}
      </div>
    </a>
  `).join('');
}

function setupDropZone() {
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  
  dropZone.addEventListener('click', () => fileInput.click());
  
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });
  
  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });
  
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    handleFiles(e.dataTransfer.files);
  });
  
  fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
  });
}

async function handleFiles(files) {
  for (const file of files) {
    if (file.name.endsWith('.md')) {
      const content = await file.text();
      uploadedDocs.push({ name: file.name, content });
      renderUploadedFiles();
    }
  }
}

function renderUploadedFiles() {
  const container = document.getElementById('uploadedFiles');
  container.innerHTML = uploadedDocs.map((doc, idx) => `
    <div class="flex items-center justify-between bg-purple-50 px-3 py-2 rounded-lg">
      <span class="text-sm text-purple-700">${doc.name}</span>
      <button onclick="removeFile(${idx})" class="text-red-500 hover:text-red-700 text-sm">Remove</button>
    </div>
  `).join('');
}

window.removeFile = (idx) => {
  uploadedDocs.splice(idx, 1);
  renderUploadedFiles();
};

async function generateRecap() {
  if (linearIssues.length === 0 && uploadedDocs.length === 0) {
    alert('Please fetch Linear issues or upload performance docs first');
    return;
  }
  
  showLoading('Generating summary with Gemini...');
  
  const issuesSummary = linearIssues.map(issue => 
    `- [${issue.identifier}] ${issue.title}${issue.project?.name ? ` (${issue.project.name})` : ''}`
  ).join('\n');
  
  const docsSummary = uploadedDocs.map(doc => 
    `### ${doc.name}\n${doc.content}`
  ).join('\n\n');
  
  const prompt = `
You are a performance review expert. Please create a clean performance summary based on the following information.

## Completed Linear Issues:
${issuesSummary || 'None'}

## Performance Documents:
${docsSummary || 'None'}

## Requirements:
1. Group by category (Feature Development, Bug Fixes, Documentation, Others)
2. Highlight high-impact items
3. Output in clean markdown format
4. Write in English
5. Write in a professional performance review style
`;

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    document.getElementById('recapResult').innerHTML = markdownToHtml(text);
    document.getElementById('resultCard').classList.remove('hidden');
    document.getElementById('resultCard').scrollIntoView({ behavior: 'smooth' });
  } catch (error) {
    console.error('Gemini API Error:', error);
    alert('Failed to generate summary: ' + error.message);
  } finally {
    hideLoading();
  }
}

function markdownToHtml(markdown) {
  return markdown
    .replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold mt-6 mb-3">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mt-6 mb-4">$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^- (.*$)/gim, '<li class="ml-4">$1</li>')
    .replace(/\n/g, '<br>');
}

function copyResult() {
  const resultText = document.getElementById('recapResult').innerText;
  navigator.clipboard.writeText(resultText).then(() => {
    const btn = document.getElementById('copyResult');
    btn.textContent = 'Copied!';
    setTimeout(() => btn.textContent = 'Copy', 2000);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  setDefaultDates();
  setupDropZone();
  
  document.getElementById('fetchLinear').addEventListener('click', fetchLinearIssues);
  document.getElementById('generateRecap').addEventListener('click', generateRecap);
  document.getElementById('copyResult').addEventListener('click', copyResult);
});
