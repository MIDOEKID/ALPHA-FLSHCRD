let flashcardData = [];
let shareableLink = '';

// Initialize Application
function initializeApp() {
    const params = new URLSearchParams(window.location.search);
    
    if(params.has('admin')) {
        showAdminPanel();
    } else if(params.has('shared')) {
        showCandidateView();
        loadSharedContent();
    } else {
        window.location.search = '?admin';
    }

    // Add view controls handler
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', () => switchView(btn.dataset.view));
    });
}

// View Management
function showAdminPanel() {
    document.getElementById('adminPanel').style.display = 'block';
    document.getElementById('candidateView').style.display = 'none';
}

function showCandidateView() {
    document.getElementById('adminPanel').style.display = 'none';
    document.getElementById('candidateView').style.display = 'block';
    switchView('questions');
}

function switchView(view) {
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });
    
    document.querySelectorAll('.active-view').forEach(el => el.classList.remove('active-view'));
    document.getElementById(`${view}View`).classList.add('active-view');
}

// File Processing
async function processFile() {
    try {
        const file = document.getElementById('fileInput').files[0];
        if (!file) throw new Error('Please select a file first');
        
        if (file.size > 1024 * 1024 * 1024) {
            throw new Error('File exceeds 1GB limit');
        }

        const text = await extractText(file);
        flashcardData = parseContent(text);
        
        if (flashcardData.length === 0) throw new Error('No valid content found');
        
        updateDisplays();
        generateShareLink();
        
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

// Text Extraction
async function extractText(file) {
    try {
        if (file.type === 'application/pdf') {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
            let text = '';
            
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                text += content.items.map(item => item.str).join('\n');
            }
            return text;
        }
        
        if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            const result = await mammoth.extractRawText({ 
                arrayBuffer: await file.arrayBuffer() 
            });
            return result.value;
        }
        
        if (file.type === 'text/plain') {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsText(file);
            });
        }
        
        throw new Error('Unsupported file type');
    } catch (error) {
        throw new Error(`File processing failed: ${error.message}`);
    }
}

// Content Parsing
function parseContent(text) {
    const patterns = [
        /Question:\s*(.+?)\s*Answer:\s*(.+?)(?=\nQuestion:|$)/gis,
        /Q:\s*(.+?)\s*A:\s*(.+?)(?=\nQ:|$)/gis,
        /([^\n]+?)\s*[-–—]\s*([^\n]+)/g,
        /(.+?)\?\s*([^\n]+)/g
    ];
    
    for (const pattern of patterns) {
        const matches = [...text.matchAll(pattern)];
        if (matches.length > 0) {
            return matches.map(match => ({
                id: crypto.randomUUID(),
                question: cleanText(match[1]),
                answer: cleanText(match[2])
            }));
        }
    }
    
    throw new Error('No recognizable Q/A format found');
}

function cleanText(text) {
    return text
        .replace(/\n/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

// Display Management
function updateDisplays() {
    updateQuestionsList();
    updateFlashcards();
}

function updateQuestionsList() {
    const container = document.getElementById('questionsView');
    container.innerHTML = flashcardData.map((q, index) => `
        <div class="question-card">
            <h3>Question ${index + 1}</h3>
            <p>${q.question}</p>
            <details>
                <summary>View Answer</summary>
                <p>${q.answer}</p>
            </details>
        </div>
    `).join('');
}

function updateFlashcards() {
    const container = document.getElementById('flashcardsView');
    container.innerHTML = flashcardData.map(card => `
        <div class="flashcard" onclick="toggleCard(this)">
            <div class="flashcard-inner">
                <div class="card-face">${card.question}</div>
                <div class="card-face card-back">${card.answer}</div>
            </div>
        </div>
    `).join('');
}

// Card Interaction
function toggleCard(cardElement) {
    cardElement.classList.toggle('flipped');
}

// Sharing System
function generateShareLink() {
    try {
        const jsonString = JSON.stringify(flashcardData);
        const encodedData = btoa(unescape(encodeURIComponent(jsonString)));
        shareableLink = `${window.location.origin}?shared=${encodedData}`;
        document.getElementById('shareLink').textContent = shareableLink;
    } catch (error) {
        alert('Failed to generate share link');
    }
}

function copyShareLink() {
    navigator.clipboard.writeText(shareableLink)
        .then(() => alert('Link copied to clipboard!'))
        .catch(() => alert('Failed to copy link'));
}

// Shared Content Loading
function loadSharedContent() {
    try {
        const params = new URLSearchParams(window.location.search);
        const encodedData = params.get('shared');
        
        if (encodedData) {
            const jsonString = decodeURIComponent(escape(atob(encodedData)));
            flashcardData = JSON.parse(jsonString);
            updateDisplays();
            switchView('questions');
        }
    } catch (error) {
        alert('Invalid shared content');
    }
}

// Initialize Application
window.addEventListener('DOMContentLoaded', initializeApp);