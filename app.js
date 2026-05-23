document.addEventListener('DOMContentLoaded', () => {
    const generateBtn = document.getElementById('generate-btn');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const container = document.getElementById('verses-container');
    const loadingEl = document.getElementById('loading');
    const errorEl = document.getElementById('error-message');

    // API Configuration
    const API_BASE = 'https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1';
    const FETCH_TIMEOUT_MS = 10000;
    
    // Metadata
    const BOOK_METADATA = {
        bukhari: { name: 'Sahih al-Bukhari', sections: 97 },
        muslim: { name: 'Sahih Muslim', sections: 56 },
        abudawud: { name: 'Sunan Abi Dawud', sections: 43 },
        tirmidhi: { name: 'Jami` at-Tirmidhi', sections: 49 },
        nasai: { name: 'Sunan an-Nasai', sections: 51 }
    };

    const BOOKS = Object.keys(BOOK_METADATA);

    // State
    let state = {
        bookId: null,
        sectionId: null,
        hadithIndex: 0,
        mergedData: []
    };

    generateBtn.addEventListener('click', handleGenerate);
    prevBtn.addEventListener('click', () => handleNavigate(-1));
    nextBtn.addEventListener('click', () => handleNavigate(1));

    async function handleGenerate() {
        resetUI();
        loadingEl.classList.remove('hidden');
        generateBtn.disabled = true;

        try {
            const randomBookId = BOOKS[Math.floor(Math.random() * BOOKS.length)];
            state.bookId = randomBookId;

            let validSectionFound = false;
            let attempts = 0;

            while (!validSectionFound && attempts < 8) {
                const maxSections = BOOK_METADATA[state.bookId].sections;
                state.sectionId = Math.floor(Math.random() * maxSections) + 1;

                try {
                    await fetchSectionData(state.bookId, state.sectionId);
                    validSectionFound = true;
                } catch (err) {
                    console.warn(`Section ${state.sectionId} failed, retrying...`);
                    attempts++;
                }
            }

            if (!validSectionFound) throw new Error('Could not find a valid hadith section.');

            state.hadithIndex = Math.floor(Math.random() * state.mergedData.length);

            renderHadith();
            updateButtonUI();

        } catch (error) {
            console.error(error);
            showError('Failed to fetch hadith. Please try again.');
        } finally {
            loadingEl.classList.add('hidden');
            generateBtn.disabled = false;
        }
    }

    async function fetchSectionData(bookId, sectionId) {
        const [engJson, araJson] = await Promise.all([
            fetchJson(`${API_BASE}/editions/eng-${bookId}/sections/${sectionId}.json`),
            fetchJson(`${API_BASE}/editions/ara-${bookId}/sections/${sectionId}.json`)
        ]);

        state.mergedData = engJson.hadiths.map(engHadith => {
            const araHadith = araJson.hadiths.find(a => a.hadithnumber === engHadith.hadithnumber);
            return {
                ...engHadith,
                arabicText: araHadith ? araHadith.text : '',
                bookName: BOOK_METADATA[bookId].name,
                sectionName: (engJson.metadata && engJson.metadata.section) 
                             ? engJson.metadata.section[sectionId] 
                             : `Chapter ${sectionId}`
            };
        });
        
        if (state.mergedData.length === 0) throw new Error('Empty section');
    }

    function handleNavigate(direction) {
        const newIndex = state.hadithIndex + direction;

        if (newIndex >= 0 && newIndex < state.mergedData.length) {
            const oldHeight = container.scrollHeight;
            const oldScrollY = window.scrollY;

            state.hadithIndex = newIndex;
            
            const hadith = state.mergedData[state.hadithIndex];
            const card = createHadithCard(hadith, false); // isMain is false, but label removed anyway

            if (direction === -1) {
                container.prepend(card);
                const newHeight = container.scrollHeight;
                window.scrollTo(0, oldScrollY + (newHeight - oldHeight));
            } else {
                container.appendChild(card);
            }

            updateButtonUI();
        }
    }

    function createHadithCard(hadith, isMain) {
        const card = document.createElement('div');
        // We keep the class 'main-verse' for the visual border highlight, 
        // but the text label inside will be generic.
        card.className = `verse-card ${isMain ? 'main-verse' : 'context-verse'}`;
        
        const cleanText = stripTags(hadith.text || '');

        const header = document.createElement('div');
        header.className = 'verse-header';
        const book = document.createElement('span');
        book.style.fontWeight = '600';
        book.style.color = 'var(--text-primary)';
        book.textContent = hadith.bookName || '';
        const badge = document.createElement('span');
        badge.className = 'badge';
        badge.textContent = `#${hadith.hadithnumber}`;
        header.append(book, badge);

        const section = document.createElement('div');
        section.className = 'verse-sub-header';
        section.textContent = hadith.sectionName || '';

        const arabic = document.createElement('div');
        arabic.className = 'arabic-text';
        arabic.textContent = stripTags(hadith.arabicText || '');

        const translation = document.createElement('div');
        translation.className = 'translation-text';
        translation.textContent = cleanText;

        const grades = document.createElement('div');
        grades.className = 'grades-footer';
        appendGrades(grades, hadith.grades);

        card.append(header, section, arabic, translation, grades);
        return card;
    }

    function renderHadith() {
        container.innerHTML = '';
        const hadith = state.mergedData[state.hadithIndex];
        const card = createHadithCard(hadith, true);
        container.appendChild(card);
    }

    function appendGrades(container, grades) {
        if (!grades || grades.length === 0) return;
        grades.forEach(g => {
            let color = '#a3a3a3';
            const gradeLower = String(g.grade || '').toLowerCase();
            if (gradeLower.includes('sahih')) color = '#10b981';
            if (gradeLower.includes('hasan')) color = '#f59e0b';
            if (gradeLower.includes('daif')) color = '#ef4444';

            const item = document.createElement('span');
            item.style.marginRight = '12px';
            item.style.display = 'inline-block';
            const grade = document.createElement('strong');
            grade.style.color = color;
            grade.textContent = g.grade || '';
            const name = document.createElement('span');
            name.style.opacity = '0.7';
            name.textContent = ` (${g.name || ''})`;
            item.append(grade, name);
            container.appendChild(item);
        });
    }

    function updateButtonUI() {
        prevBtn.classList.remove('hidden');
        nextBtn.classList.remove('hidden');

        prevBtn.disabled = state.hadithIndex <= 0;
        nextBtn.disabled = state.hadithIndex >= state.mergedData.length - 1;

        // Simplified Buttons
        if (prevBtn.disabled) {
            prevBtn.innerHTML = '<span>Start of Chapter</span>';
            prevBtn.style.opacity = '0.5';
        } else {
            prevBtn.innerHTML = '<span class="icon">↑</span> Previous Hadith';
            prevBtn.style.opacity = '1';
        }

        if (nextBtn.disabled) {
            nextBtn.innerHTML = '<span>End of Chapter</span>';
            nextBtn.style.opacity = '0.5';
        } else {
            nextBtn.innerHTML = '<span class="icon">↓</span> Next Hadith';
            nextBtn.style.opacity = '1';
        }
    }

    function resetUI() {
        container.innerHTML = '';
        errorEl.classList.add('hidden');
        prevBtn.classList.add('hidden');
        nextBtn.classList.add('hidden');
    }

    function showError(msg) {
        errorEl.textContent = msg;
        errorEl.classList.remove('hidden');
    }

    function stripTags(value) {
        const div = document.createElement('div');
        div.innerHTML = value;
        return div.textContent || div.innerText || '';
    }

    async function fetchJson(url, attempts = 2) {
        let lastError;
        for (let attempt = 0; attempt < attempts; attempt++) {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
            try {
                const response = await fetch(url, { signal: controller.signal });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return await response.json();
            } catch (error) {
                lastError = error;
                if (attempt < attempts - 1) {
                    await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
                }
            } finally {
                clearTimeout(timeout);
            }
        }
        throw lastError || new Error('Fetch failed');
    }
});
