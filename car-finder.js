// Car Finder Application with Supabase Integration

// Ensure value is an array (Supabase may return JSON string or null)
function ensureArray(value) {
    if (Array.isArray(value)) return value;
    if (value == null || value === '') return [];
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [];
        } catch (_) {
            return [];
        }
    }
    return [];
}

const RESULTS_PAGE_SIZE = 50;
/** When strict matching returns zero cars, show this many closest tag matches instead (between 15–20). */
const CLOSEST_FALLBACK_LIMIT = 20;

function escapeHtml(value) {
    if (value == null) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

class CarFinder {
    constructor() {
        this.currentQuestion = 0;
        this.answers = {};
        this.questions = [
            {
                id: 'budget',
                text: 'What\'s your budget range?',
                options: [
                    { text: 'Under $20,000', value: 'budget_low', icon: '💰' },
                    { text: '$20,000 - $40,000', value: 'budget_medium', icon: '💵' },
                    { text: '$40,000 - $80,000', value: 'budget_high', icon: '💎' },
                    { text: '$80,000+', value: 'budget_premium', icon: '👑' }
                ]
            },
            {
                id: 'seats',
                text: 'How many seats do you need?',
                options: [
                    { text: '2–4 seats', value: 'seats_small', icon: '🧍‍♂️' },
                    { text: '5 seats', value: 'seats_medium', icon: '👨‍👩‍👧‍👦' },
                    { text: '6–8 seats', value: 'seats_large', icon: '🚐' }
                ]
            },
            {
                id: 'fuel',
                text: 'What fuel type do you prefer?',
                options: [
                    { text: 'Petrol', value: 'fuel_petrol', icon: '⛽' },
                    { text: 'Diesel', value: 'fuel_diesel', icon: '🛢️' },
                    { text: 'Hybrid', value: 'fuel_hybrid', icon: '🔋' },
                    { text: 'Electric', value: 'fuel_electric', icon: '⚡' },
                    { text: 'PHV (Plugin Hybrid)', value: 'fuel_phv', icon: '🔌' }
                ]
            },
            {
                id: 'terrain',
                text: 'Where do you mostly drive?',
                options: [
                    { text: 'City Only', value: 'terrain_city', icon: '🏙️' },
                    { text: 'Highways & Freeways', value: 'terrain_highway', icon: '🛣️' },
                    { text: 'Rural or Gravel Roads', value: 'terrain_rural', icon: '🌄' },
                    { text: 'Off-road/Adventure', value: 'terrain_offroad', icon: '🏕️' }
                ]
            },
            {
                id: 'priorities',
                text: 'What\'s most important to you?',
                options: [
                    { text: 'Family & Practicality', value: 'priorities_family', icon: '👨‍👩‍👧‍👦' },
                    { text: 'Performance & Sporty Driving', value: 'priorities_performance', icon: '🏎️' },
                    { text: 'Comfort & Luxury', value: 'priorities_comfort', icon: '🛋️' },
                    { text: 'Fuel Efficiency & Eco-friendly', value: 'priorities_efficiency', icon: '🌱' }
                ]
            },
            {
                id: 'engine_size',
                text: 'What engine power do you prefer?',
                options: [
                    { text: 'Small & Fuel Efficient (e.g. 0.6–1.5L)', value: 'engine_small', icon: '🌱' },
                    { text: 'Balanced Performance (e.g. 1.6–2.5L)', value: 'engine_medium', icon: '⚙️' },
                    { text: 'High Performance / Towing (2.5L)', value: 'engine_large', icon: '🏋️' }
                ]
            },
            {
                id: 'boot_size',
                text: 'How much boot/luggage space do you need?',
                options: [
                    { text: 'Small – just groceries or daily items', value: 'boot_small', icon: '🛍️' },
                    { text: 'Medium – weekend bags or stroller', value: 'boot_medium', icon: '🧳' },
                    { text: 'Large – prams, camping gear or delivery use', value: 'boot_large', icon: '📦' }
                ]
            },
            {
                id: 'driver_assist',
                text: 'Which level of driving technology do you prefer?',
                options: [
                    { text: 'No tech needed – keep it simple', value: 'tech_none', icon: '🧭' },
                    { text: 'Basic cruise control or reversing camera', value: 'tech_basic', icon: '🛞' },
                    { text: 'Advanced features (e.g. lane assist, radar cruise)', value: 'tech_advanced', icon: '🧠' }
                ]
            },
            {
                id: 'year',
                text: 'What year car are you looking for?',
                options: [
                    { text: 'Brand-new', value: 'year_new', icon: '🆕' },
                    { text: '1-2 years', value: 'year_1_2', icon: '2️⃣' },
                    { text: '2-5 years', value: 'year_2_5', icon: '5️⃣' },
                    { text: '5-10 years', value: 'year_5_10', icon: '🔟' },
                    { text: '10-15 years', value: 'year_10_15', icon: '1️⃣5️⃣' },
                    { text: '15-20 years', value: 'year_15_20', icon: '2️⃣0️⃣' },
                    { text: '20 years+', value: 'year_20_plus', icon: '🔁' }
                ]
            },
            {
                id: 'special_type',
                text: 'Are you looking for a special type of vehicle?',
                options: [
                    { text: 'Welcab (wheelchair accessible)', value: 'special_welcab', icon: '♿' },
                    { text: 'Campervan', value: 'special_campervan', icon: '🚐' },
                    { text: 'Work Vehicle (truck/van)', value: 'special_work', icon: '🚚' },
                    { text: 'Normal Car', value: 'special_normal', icon: '🚗' }
                ]
            },
        ];

        // Initialize Supabase
        this.supabase = supabase.createClient(
            'https://xzbrhvgqdsqydmxuyjbg.supabase.co',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6YnJodmdxZHNxeWRteHV5amJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM1MDY0NzYsImV4cCI6MjA2OTA4MjQ3Nn0.rQjz1Gcx295olkigYoZxWdqqb0EHDl0VYmlNFKCBGpM'
        );
        
        // Initialize car database as empty - will be loaded from Supabase
        this.carDatabase = [];
        
        // Store parsed makes and models for dropdowns
        this.carMakes = [];
        this.carModelsByMake = {};
        
        // Inquiry form: current step (1-based)
        this.inquiryStep = 1;
        this.inquiryTotalSteps = 3;
        this.isAdvancingQuestion = false;
        this.blockHomeNavigationUntil = 0;
        this._previewUpdateRaf = null;
        this._fullMatchedCarsData = null;
        this._resultsCurrentPage = 1;
        this._lastResultsWereFallback = false;
        
        // Load cars from Supabase
        this.loadCarsFromSupabase();

        this.init();
    }

    async loadCarsFromSupabase() {
        try {
            console.log('Loading cars from Supabase...');
            const { data, error } = await this.supabase
                .from('cars')
                .select('*');

            if (error) {
                console.error('Error loading cars from Supabase:', error);
                return;
            }

            if (data) {
                // Transform the data to match the expected format
                // Ensure tags and features are always arrays (Supabase may return JSON strings)
                this.carDatabase = data.map(car => ({
                    id: car.id,
                    name: car.name,
                    price: car.price_range,
                    imageExterior: car.image_exterior_url,
                    imageInterior: car.image_interior_url,
                    video: car.video_url,
                    description: car.description,
                    features: ensureArray(car.features),
                    tags: ensureArray(car.tags),
                    // New enhanced fields
                    engine_size: car.engine_size,
                    horsepower: car.horsepower,
                    torque: car.torque,
                    acceleration: car.acceleration,
                    transmission: car.transmission,
                    drivetrain: car.drivetrain,
                    dimensions: car.dimensions,
                    seating_capacity: car.seating_capacity,
                    boot_size: car.boot_size,
                    towing_capacity: car.towing_capacity,
                    fuel_economy: car.fuel_economy,
                    available_grades: car.available_grades,
                    detailed_description: car.detailed_description,
                    pros: car.pros,
                    youtube_search_query: car.youtube_search_query,
                    year_range: car.year_range,
                    generation: car.generation,
                    safety_rating: car.safety_rating,
                    expiry_date: car.expiry_date ?? car.expiry ?? car.import_expiry_date ?? car.expirery_date ?? null
                }));
                
                console.log(`Loaded ${this.carDatabase.length} cars from Supabase`);
                console.log('Total cars in database:', this.carDatabase.length);
                
                // Debug: Check how many cars have tags
                const carsWithTags = this.carDatabase.filter(car => car.tags && car.tags.length > 0);
                console.log(`Cars with tags: ${carsWithTags.length}`);
                console.log(`Cars without tags: ${this.carDatabase.length - carsWithTags.length}`);
                
                // Parse car names to extract makes and models
                this.parseCarMakesAndModels();
            }
        } catch (error) {
            console.error('Error loading cars from Supabase:', error);
        }
    }

    parseCarMakesAndModels() {
        // Parse car names to extract make (first word) and model (rest)
        const makesSet = new Set();
        const modelsByMake = {};

        this.carDatabase.forEach(car => {
            if (!car.name || typeof car.name !== 'string') return;
            
            const nameParts = car.name.trim().split(/\s+/);
            if (nameParts.length < 2) return; // Skip if name is too short
            
            // First word is the make
            const make = nameParts[0];
            // Rest is the model
            const model = nameParts.slice(1).join(' ');
            
            // Normalize make (capitalize first letter, lowercase rest)
            const normalizedMake = make.charAt(0).toUpperCase() + make.slice(1).toLowerCase();
            
            makesSet.add(normalizedMake);
            
            // Store models by make
            if (!modelsByMake[normalizedMake]) {
                modelsByMake[normalizedMake] = new Set();
            }
            modelsByMake[normalizedMake].add(model);
        });

        // Convert sets to sorted arrays
        this.carMakes = Array.from(makesSet).sort();
        this.carModelsByMake = {};
        
        Object.keys(modelsByMake).forEach(make => {
            this.carModelsByMake[make] = Array.from(modelsByMake[make]).sort();
        });

        console.log('Parsed makes:', this.carMakes);
        console.log('Models by make:', this.carModelsByMake);
        
        // Populate dropdowns if inquiry screen is available
        this.populateMakeDropdown();
    }

    populateMakeDropdown() {
        const makeSelect = document.getElementById('car-make');
        if (!makeSelect) return;

        // Clear existing options except "Select Make"
        makeSelect.innerHTML = '<option value="">Select Make</option>';

        // Add makes from parsed data
        this.carMakes.forEach(make => {
            const option = document.createElement('option');
            option.value = make;
            option.textContent = make;
            makeSelect.appendChild(option);
        });

        const otherOption = document.createElement('option');
        otherOption.value = 'other';
        otherOption.textContent = 'Other / Not listed';
        makeSelect.appendChild(otherOption);

        // Remove old event listeners by cloning the element
        if (!makeSelect.dataset.listenerAdded) {
            makeSelect.addEventListener('change', (e) => {
                this.populateModelDropdown(e.target.value);
                this.updateOtherCarFields();
                this.applySelectedCarYearRange();
                this.updateInquirySelectedCarPreview();
            });
            makeSelect.dataset.listenerAdded = 'true';
        }
    }

    populateModelDropdown(selectedMake) {
        const modelSelect = document.getElementById('car-model');
        if (!modelSelect) return;

        // Clear existing options
        modelSelect.innerHTML = '<option value="">Select Model</option>';

        if (!selectedMake || selectedMake === '') {
            return;
        }

        if (selectedMake === 'other') {
            modelSelect.innerHTML = '<option value="other">Other / Not listed</option>';
            modelSelect.value = 'other';
            return;
        }

        // Get models for this make
        const models = this.carModelsByMake[selectedMake] || [];

        // Add models to dropdown
        models.forEach(model => {
            const option = document.createElement('option');
            option.value = model;
            option.textContent = model;
            modelSelect.appendChild(option);
        });

        const otherOption = document.createElement('option');
        otherOption.value = 'other';
        otherOption.textContent = 'Other / Not listed';
        modelSelect.appendChild(otherOption);
    }

    getEffectiveNewerSelection() {
        const makeSelect = document.getElementById('car-make');
        const modelSelect = document.getElementById('car-model');
        const otherMakeInput = document.getElementById('other-car-make');
        const otherModelInput = document.getElementById('other-car-model');
        const rawMake = makeSelect?.value || '';
        const rawModel = modelSelect?.value || '';
        const effectiveMake = rawMake === 'other' ? (otherMakeInput?.value || '').trim() : rawMake;
        const effectiveModel = rawModel === 'other' ? (otherModelInput?.value || '').trim() : rawModel;

        return {
            rawMake,
            rawModel,
            make: effectiveMake,
            model: effectiveModel,
            isOther: rawMake === 'other' || rawModel === 'other'
        };
    }

    updateOtherCarFields() {
        const makeSelect = document.getElementById('car-make');
        const modelSelect = document.getElementById('car-model');
        const otherMakeGroup = document.getElementById('other-make-group');
        const otherModelGroup = document.getElementById('other-model-group');
        const otherMakeInput = document.getElementById('other-car-make');
        const otherModelInput = document.getElementById('other-car-model');
        const rawMake = makeSelect?.value || '';
        const rawModel = modelSelect?.value || '';
        const showOtherMake = rawMake === 'other';
        const showOtherModel = rawMake === 'other' || rawModel === 'other';

        if (otherMakeGroup) otherMakeGroup.style.display = showOtherMake ? 'block' : 'none';
        if (otherModelGroup) otherModelGroup.style.display = showOtherModel ? 'block' : 'none';
        if (otherMakeInput) otherMakeInput.required = showOtherMake;
        if (otherModelInput) otherModelInput.required = showOtherModel;

        if (!showOtherMake && otherMakeInput) {
            otherMakeInput.value = '';
        }
        if (!showOtherModel && otherModelInput) {
            otherModelInput.value = '';
        }
    }

    parseYearRange(yearRange) {
        if (!yearRange || typeof yearRange !== 'string') return null;
        const years = (yearRange.match(/\b(19|20)\d{2}\b/g) || []).map(year => parseInt(year, 10));
        if (years.length === 0) return null;
        const minYear = Math.min(...years);
        const maxYear = Math.max(...years);
        const options = [];
        for (let year = maxYear; year >= minYear; year--) {
            options.push(year);
        }
        return options;
    }

    setInquiryYearOptions(yearOptions) {
        const yearFromSelect = document.getElementById('year-from');
        const yearToSelect = document.getElementById('year-to');
        if (!yearFromSelect || !yearToSelect) return;

        const availableYears = Array.isArray(yearOptions) && yearOptions.length > 0
            ? [...yearOptions]
            : [...(this.defaultInquiryYearOptions || [])];
        const currentFromValue = yearFromSelect.value;
        const currentToValue = yearToSelect.value;

        this.allYearOptions = availableYears;
        yearFromSelect.innerHTML = '<option value="">Not specified</option>';
        yearToSelect.innerHTML = '<option value="">Not specified</option>';

        availableYears.forEach(year => {
            const optionFrom = document.createElement('option');
            optionFrom.value = year;
            optionFrom.textContent = year;
            yearFromSelect.appendChild(optionFrom);

            const optionTo = document.createElement('option');
            optionTo.value = year;
            optionTo.textContent = year;
            yearToSelect.appendChild(optionTo);
        });

        if (currentFromValue && availableYears.includes(parseInt(currentFromValue, 10))) {
            yearFromSelect.value = currentFromValue;
        }
        this.updateYearToDropdown();
        if (currentToValue && availableYears.includes(parseInt(currentToValue, 10))) {
            yearToSelect.value = currentToValue;
        }
    }

    applySelectedCarYearRange() {
        const age = document.querySelector('input[name="car_age"]:checked');
        if (!age || age.value !== 'newer') {
            this.setInquiryYearOptions(this.defaultInquiryYearOptions);
            return;
        }

        const selection = this.getEffectiveNewerSelection();
        if (selection.isOther || !selection.make || !selection.model) {
            this.setInquiryYearOptions(this.defaultInquiryYearOptions);
            return;
        }

        const car = this.findCarByMakeAndModel(selection.make, selection.model);
        const limitedYears = this.parseYearRange(car?.year_range);
        this.setInquiryYearOptions(limitedYears || this.defaultInquiryYearOptions);
    }

    init() {
        this.bindEvents();
        this.updateProgress();
    }

    bindEvents() {
        // Event delegation for option buttons
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('.option-btn');
            if (btn) {
                this.selectOption(btn);
            }
        });
    }

    startCarFinder() {
        this.currentQuestion = 0;
        this.answers = {};
        this._lastResultsWereFallback = false;
        this.updateCarPreview();
        this.showScreen('question-screen');
        this.displayQuestion();
    }

    showScreen(screenId) {
        // Hide all screens
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        
        // Show target screen
        document.getElementById(screenId).classList.add('active');

        // Reset scroll position after every screen change.
        const root = document.documentElement;
        const body = document.body;
        if (root) root.scrollTop = 0;
        if (body) body.scrollTop = 0;
        try {
            window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        } catch (_) {
            window.scrollTo(0, 0);
        }
    }

    displayQuestion() {
        if (this._previewUpdateRaf != null) {
            cancelAnimationFrame(this._previewUpdateRaf);
            this._previewUpdateRaf = null;
        }

        const question = this.questions[this.currentQuestion];
        const questionText = document.getElementById('question-text');
        const optionsContainer = document.getElementById('options-container');

        questionText.textContent = question.text;
        
        optionsContainer.innerHTML = `
            <div class="selection-instruction">
                <i class="fas fa-mouse-pointer"></i>
                <span>Select all that apply (click to select/deselect)</span>
            </div>
            ${question.options.map(option => `
                <button type="button" class="option-btn${(this.answers[question.id] && this.answers[question.id].includes(option.value)) ? ' selected' : ''}" data-value="${option.value}">
                    <span class="option-icon">${option.icon}</span>
                    <span class="option-text">${option.text}</span>
                    <span class="selection-indicator">
                        <i class="fas fa-check"></i>
                    </span>
                </button>
            `).join('')}
            <div class="next-button-container">
                <button type="button" class="next-btn" onclick="nextQuestion(event)" id="next-btn">
                    <span>Next Question</span>
                    <i class="fas fa-arrow-right"></i>
                </button>
            </div>
        `;

        this.updateProgress();
        this.updateNextButton();
    }

    selectOption(button) {
        // iOS: reduce accidental "Back to Home" hits after layout shifts + debounce heavy preview DOM.
        this.blockAccidentalHomeNavFor(1000);

        const question = this.questions[this.currentQuestion];
        const selectedValue = button.dataset.value;
        
        // Toggle selection
        if (button.classList.contains('selected')) {
            // Deselect
            button.classList.remove('selected');
            // Remove from answers array
            if (this.answers[question.id]) {
                this.answers[question.id] = this.answers[question.id].filter(value => value !== selectedValue);
                if (this.answers[question.id].length === 0) {
                    delete this.answers[question.id];
                }
            }
        } else {
            // Select
            button.classList.add('selected');
            // Add to answers array
            if (!this.answers[question.id]) {
                this.answers[question.id] = [];
            }
            this.answers[question.id].push(selectedValue);
        }

        this.scheduleCarPreviewUpdate();
        this.updateNextButton();
    }

    scheduleCarPreviewUpdate() {
        if (this._previewUpdateRaf != null) {
            cancelAnimationFrame(this._previewUpdateRaf);
        }
        this._previewUpdateRaf = requestAnimationFrame(() => {
            this._previewUpdateRaf = null;
            this.updateCarPreview();
        });
    }

    blockAccidentalHomeNavFor(ms) {
        const until = Date.now() + ms;
        if (until > this.blockHomeNavigationUntil) {
            this.blockHomeNavigationUntil = until;
        }
    }

    getResultsTotalPages() {
        const total = this._fullMatchedCarsData?.length ?? 0;
        return Math.max(1, Math.ceil(total / RESULTS_PAGE_SIZE));
    }

    renderCurrentResultsPage() {
        const grid = document.getElementById('results-grid');
        const full = this._fullMatchedCarsData;
        if (!grid || !full || full.length === 0) return;

        const totalPages = this.getResultsTotalPages();
        const page = Math.min(Math.max(1, this._resultsCurrentPage), totalPages);
        this._resultsCurrentPage = page;

        const start = (page - 1) * RESULTS_PAGE_SIZE;
        const slice = full.slice(start, start + RESULTS_PAGE_SIZE);
        grid.innerHTML = slice.map((carData, i) => this.buildResultCardHtml(carData, start + i)).join('');
    }

    buildResultsPaginationHtml() {
        const total = this._fullMatchedCarsData?.length ?? 0;
        const totalPages = this.getResultsTotalPages();
        const current = this._resultsCurrentPage;

        if (total <= RESULTS_PAGE_SIZE || totalPages <= 1) {
            return '';
        }

        const linkWindow = 10;
        const blockIndex = Math.floor((current - 1) / linkWindow);
        const rangeStart = blockIndex * linkWindow + 1;
        const rangeEnd = Math.min(rangeStart + linkWindow - 1, totalPages);

        let html = '<nav class="results-pagination-inner" role="navigation">';

        if (rangeStart > 1) {
            html += `<button type="button" class="results-page-nav results-page-link" onclick="goToResultsPage(event, ${rangeStart - 1})">Previous</button>`;
        }

        for (let p = rangeStart; p <= rangeEnd; p++) {
            if (p === current) {
                html += `<span class="results-page-current" aria-current="page">${p}</span>`;
            } else {
                html += `<button type="button" class="results-page-link" onclick="goToResultsPage(event, ${p})">${p}</button>`;
            }
        }

        if (rangeEnd < totalPages) {
            html += `<button type="button" class="results-page-nav results-page-link" onclick="goToResultsPage(event, ${rangeEnd + 1})">Next</button>`;
        }

        html += '</nav>';
        html += `<p class="results-page-meta">Page ${current} of ${totalPages} · ${total} matches</p>`;
        return html;
    }

    renderResultsPagination() {
        const wrap = document.getElementById('results-pagination');
        if (!wrap) return;
        wrap.innerHTML = this.buildResultsPaginationHtml();
    }

    goToResultsPage(page) {
        const total = this._fullMatchedCarsData?.length ?? 0;
        if (total === 0) return;

        const totalPages = this.getResultsTotalPages();
        let p = parseInt(page, 10);
        if (Number.isNaN(p) || p < 1) p = 1;
        if (p > totalPages) p = totalPages;

        this._resultsCurrentPage = p;
        this.blockAccidentalHomeNavFor(800);
        this.renderCurrentResultsPage();
        this.renderResultsPagination();

        const heading = document.querySelector('#results-screen h2');
        if (heading) {
            try {
                heading.scrollIntoView({ block: 'start', behavior: 'smooth' });
            } catch (_) {
                heading.scrollIntoView(true);
            }
        }
    }

    buildResultCardHtml(carData, index) {
        const car = carData.car;
        const name = escapeHtml(car.name);
        const price = escapeHtml(car.price);
        const desc = escapeHtml(car.description);
        const features = Array.from(ensureArray(car.features || []))
            .map(feature => `<span class="feature-tag">${escapeHtml(feature)}</span>`)
            .join('');
        return `
                    <div class="car-card" style="animation-delay: ${(index % 20) * 0.05}s">
                        <img src="${car.imageExterior || ''}" alt="${name}" class="car-card-image" loading="lazy">
                        <div class="car-card-content">
                            <h3>${name}</h3>
                            <p class="car-price">${price}</p>
                            <p>${desc}</p>
                            <div class="car-features">
                                ${features}
                            </div>
                            <div class="car-card-actions">
                                <button type="button" class="view-details-btn" onclick="viewCarDetails(${JSON.stringify(car.id)})">
                                    View Details
                                </button>
                                <button type="button" class="contact-btn" onclick="contactAboutCar(${JSON.stringify(car.id)})">
                                    Contact About This Car
                                </button>
                            </div>
                        </div>
                    </div>
                `;
    }

    nextQuestion() {
        if (this.isAdvancingQuestion) return;
        this.isAdvancingQuestion = true;
        this.blockAccidentalHomeNavFor(2200);

        const releaseAdvanceLock = () => {
            setTimeout(() => {
                this.isAdvancingQuestion = false;
            }, 250);
        };

        this.currentQuestion++;
        
        if (this.currentQuestion < this.questions.length) {
            this.displayQuestion();
            this.scrollQuestionToTop();
            releaseAdvanceLock();
        } else {
            try {
                this.showResults();
                releaseAdvanceLock();
            } catch (err) {
                console.error('Error showing results:', err);
                this.showScreen('results-screen');
                const resultsCount = document.getElementById('results-count');
                const resultsGrid = document.getElementById('results-grid');
                if (resultsCount) resultsCount.innerHTML = `<div class="count-display no-results"><span>Something went wrong</span></div>`;
                if (resultsGrid) resultsGrid.innerHTML = `<div class="no-results"><p>Please try again or contact us.</p></div>`;
                releaseAdvanceLock();
            }
        }
    }

    scrollQuestionToTop() {
        const questionHeading = document.getElementById('question-text');
        if (!questionHeading) return;
        try {
            questionHeading.scrollIntoView({ block: 'start', behavior: 'auto' });
        } catch (_) {
            const top = questionHeading.getBoundingClientRect().top + window.pageYOffset - 12;
            window.scrollTo(0, Math.max(0, top));
        }
    }

    canNavigateHomeNow() {
        return Date.now() >= this.blockHomeNavigationUntil;
    }

    updateProgress() {
        const progress = (this.currentQuestion / this.questions.length) * 100;
        document.getElementById('progress-fill').style.width = `${progress}%`;
    }

    updateNextButton() {
        const nextBtn = document.getElementById('next-btn');
        const question = this.questions[this.currentQuestion];
        
        if (this.answers[question.id] && this.answers[question.id].length > 0) {
            nextBtn.disabled = false;
            nextBtn.classList.add('active');
        } else {
            nextBtn.disabled = true;
            nextBtn.classList.remove('active');
        }
    }

    updateCarPreview() {
        const bestMatchingCar = this.getBestMatchingCarForPreview();
        const carDisplay = document.getElementById('car-display');
        
        if (bestMatchingCar) {
            const car = bestMatchingCar.car;
            carDisplay.innerHTML = `
                <div class="car-preview-card">
                    <img src="${car.imageExterior}" alt="${car.name}" class="car-preview-image">
                    <div class="car-preview-info">
                        <h3>${car.name}</h3>
                        <p class="car-price">${car.price}</p>
                        <p>${car.description}</p>
                    </div>
                </div>
            `;
        } else {
            carDisplay.innerHTML = `
                <div class="car-placeholder">
                    <i class="fas fa-car-side"></i>
                    <p>Your perfect car will appear here</p>
                </div>
            `;
        }
    }

    getBestMatchingCarForPreview() {
        // This method is for preview only - no threshold filtering
        const selectedTagsByQuestion = this.answers;
        
        if (Object.keys(selectedTagsByQuestion).length === 0) {
            return null; // No answers selected yet
        }

        let bestMatch = null;
        let bestPercentage = 0;

        // Check each car and find the one with highest match percentage
        this.carDatabase.forEach(car => {
            const tags = ensureArray(car.tags);
            if (tags.length > 0) {
                const carTotalTags = tags.length;
                const allSelectedTags = Object.values(selectedTagsByQuestion).flat();
                
                if (allSelectedTags.length > 0) {
                    // Count how many of the car's tags match the user's selected tags
                    const matchCount = tags.filter(carTag => allSelectedTags.includes(carTag)).length;
                    const matchPercentage = carTotalTags > 0 ? (matchCount / carTotalTags) : 0;
                    
                    // Update best match if this car has higher percentage
                    if (matchPercentage > bestPercentage) {
                        bestPercentage = matchPercentage;
                        bestMatch = {
                            car,
                            matchCount,
                            carTotalTags,
                            matchPercentage
                        };
                    }
                }
            }
        });

        return bestMatch;
    }

    /**
     * When strict filters yield no cars, rank all vehicles by overlap with the user's selected tags
     * and return the top `limit` entries (default 20).
     */
    buildClosestMatchFallback(selectedTagsByQuestion, limit = CLOSEST_FALLBACK_LIMIT) {
        const allSelectedTags = Object.values(selectedTagsByQuestion).flat();
        if (allSelectedTags.length === 0 || !this.carDatabase.length) {
            return [];
        }

        const scored = this.carDatabase.map(car => {
            const tags = ensureArray(car.tags);
            const matchCount = tags.filter(t => allSelectedTags.includes(t)).length;
            const carTotalTags = tags.length;
            const matchPercentage = carTotalTags > 0 ? matchCount / carTotalTags : 0;
            const userCoverage = allSelectedTags.length > 0 ? matchCount / allSelectedTags.length : 0;
            return {
                car,
                matchCount,
                carTotalTags,
                matchPercentage,
                userCoverage,
                isClosestMatchFallback: true
            };
        });

        scored.sort((a, b) => {
            if (b.matchCount !== a.matchCount) return b.matchCount - a.matchCount;
            if (b.userCoverage !== a.userCoverage) return b.userCoverage - a.userCoverage;
            if (b.matchPercentage !== a.matchPercentage) return b.matchPercentage - a.matchPercentage;
            const an = (a.car && a.car.name) ? String(a.car.name) : '';
            const bn = (b.car && b.car.name) ? String(b.car.name) : '';
            return an.localeCompare(bn);
        });

        return scored.slice(0, limit);
    }

    getMatchedCars() {
        // Example: answers object
        // this.answers = { budget: ['budget_low', 'budget_medium'], seats: ['seats_small', 'seats_medium'], ... }

        const selectedTagsByQuestion = this.answers; // { budget: [...], seats: [...], ... }

        console.log('=== MATCHING DEBUG ===');
        console.log('Selected answers:', selectedTagsByQuestion);
        console.log('Total cars in database:', this.carDatabase.length);
        console.log('Flattened selected tags:', Object.values(selectedTagsByQuestion).flat());
        console.log('Number of selected tags:', Object.values(selectedTagsByQuestion).flat().length);

        // If no answers selected, return all cars
        if (Object.keys(selectedTagsByQuestion).length === 0) {
            console.log('No answers selected, returning all cars');
            return this.carDatabase;
        }

        // Debug: Check a few sample cars to see their tags
        console.log('Sample car tags (first 3 cars):');
        this.carDatabase.slice(0, 3).forEach((car, index) => {
            const tags = ensureArray(car.tags);
            console.log(`Car ${index + 1} (${car.name}):`, tags);
            if (tags.length > 0) {
                const allSelectedTags = Object.values(selectedTagsByQuestion).flat();
                const matchCount = allSelectedTags.filter(tag => tags.includes(tag)).length;
                const matchPercentage = allSelectedTags.length > 0 ? (matchCount / allSelectedTags.length) * 100 : 0;
                console.log(`  Would match: ${matchCount}/${allSelectedTags.length} tags (${matchPercentage.toFixed(1)}%)`);
            }
        });

        // CRITICAL: These questions must match or car is excluded regardless of percentage
        const criticalQuestions = ['budget', 'seats', 'fuel', 'year', 'special_type'];
        console.log('Critical questions enforced:', criticalQuestions);
        console.log('Critical questions with answers:', criticalQuestions.filter(q => selectedTagsByQuestion[q] && selectedTagsByQuestion[q].length > 0));

        let filteredCars = this.carDatabase.filter(car => {
            const tags = ensureArray(car.tags);
            // Check critical questions first - ALL must match if any are selected
            let criticalMatches = 0;
            let criticalTotal = 0;
            
            for (const question of criticalQuestions) {
                if (selectedTagsByQuestion[question] && selectedTagsByQuestion[question].length > 0) {
                    criticalTotal++;
                    // Car must have at least one tag that matches this critical question
                    if (tags.some(carTag => selectedTagsByQuestion[question].includes(carTag))) {
                        criticalMatches++;
                    }
                }
            }
            
            // If any critical questions are selected, ALL must match
            if (criticalTotal > 0 && criticalMatches < criticalTotal) {
                console.log(`Car "${car.name}" excluded: Critical questions mismatch (${criticalMatches}/${criticalTotal})`);
                console.log(`  Critical questions:`, criticalQuestions.filter(q => selectedTagsByQuestion[q] && selectedTagsByQuestion[q].length > 0));
                console.log(`  Car tags:`, tags);
                return false; // Exclude this car
            }
            
            // Now check the overall 75% threshold for remaining questions
            let matchCount = 0;
            let carTotalTags = tags.length;
            
            if (carTotalTags > 0) {
                const allSelectedTags = Object.values(selectedTagsByQuestion).flat();
                if (allSelectedTags.length > 0) {
                    matchCount = tags.filter(carTag => allSelectedTags.includes(carTag)).length;
                }
            }
            
            // Car must match at least 75% of its own tags to be included
            // This means if a car has 10 tags, at least 8 must match user selections
            const matchPercentage = carTotalTags > 0 ? (matchCount / carTotalTags) : 0;
            
            // Debug: Log cars that don't meet the threshold
            if (matchPercentage < 0.75) {
                console.log(`Car "${car.name}" filtered out: ${matchCount}/${carTotalTags} car tags matched (${(matchPercentage * 100).toFixed(1)}%)`);
                console.log(`  Car tags:`, tags);
                console.log(`  User selected tags:`, Object.values(selectedTagsByQuestion).flat());
            }
            
            return matchPercentage >= 0.75; // 75% threshold based on car's tags
        });

        // Score cars by their tag match percentage and sort
        filteredCars = filteredCars
            .map(car => {
                const tags = ensureArray(car.tags);
                const carTotalTags = tags.length;
                let matchCount = 0;
                if (carTotalTags > 0) {
                    const allSelectedTags = Object.values(selectedTagsByQuestion).flat();
                    if (allSelectedTags.length > 0) {
                        matchCount = tags.filter(carTag => allSelectedTags.includes(carTag)).length;
                    }
                }
                const matchPercentage = carTotalTags > 0 ? (matchCount / carTotalTags) : 0;
                
                return {
                    car,
                    matchCount: matchCount,
                    carTotalTags: carTotalTags,
                    matchPercentage: matchPercentage
                };
            })
            .sort((a, b) => {
                // Sort by match percentage first, then by match count
                if (b.matchPercentage !== a.matchPercentage) {
                    return b.matchPercentage - a.matchPercentage;
                }
                return b.matchCount - a.matchCount;
            });

        console.log(`=== FILTERING SUMMARY ===`);
        console.log(`Original cars: ${this.carDatabase.length}`);
        console.log(`Filtered cars: ${filteredCars.length}`);
        console.log(`Filtered out: ${this.carDatabase.length - filteredCars.length}`);
        console.log(`Match threshold: 75% (car tag-based scoring)`);
        console.log(`Total user selected tags: ${Object.values(selectedTagsByQuestion).flat().length}`);

        this._lastResultsWereFallback = false;

        if (
            filteredCars.length === 0 &&
            Object.keys(selectedTagsByQuestion).length > 0
        ) {
            const fallback = this.buildClosestMatchFallback(selectedTagsByQuestion, CLOSEST_FALLBACK_LIMIT);
            this._lastResultsWereFallback = fallback.length > 0;
            if (this._lastResultsWereFallback) {
                console.log(
                    `Strict filter returned 0 cars; showing ${fallback.length} closest tag matches (fallback).`
                );
            }
            return fallback;
        }

        // Return all matching cars with their scoring information
        return filteredCars;
    }

    showResults() {
        const resultsGrid = document.getElementById('results-grid');
        const resultsCount = document.getElementById('results-count');
        let matchedCarsData;

        try {
            matchedCarsData = this.getMatchedCars();
        } catch (err) {
            console.error('Error in getMatchedCars:', err);
            this.showScreen('results-screen');
            const paginationEl = document.getElementById('results-pagination');
            if (paginationEl) paginationEl.innerHTML = '';
            resultsCount.innerHTML = `
                <div class="count-display no-results">
                    <i class="fas fa-exclamation-triangle"></i>
                    <span>Something went wrong loading results</span>
                </div>
            `;
            resultsGrid.innerHTML = `
                <div class="no-results">
                    <p>We couldn't process your matches. Please try again or contact us.</p>
                </div>
            `;
            return;
        }

        // getMatchedCars can return raw car array when no answers; normalize to { car, ... } format
        if (matchedCarsData.length > 0 && matchedCarsData[0].car === undefined) {
            matchedCarsData = matchedCarsData.map(car => {
                const tags = ensureArray(car.tags);
                const allSelected = Object.values(this.answers).flat();
                const matchCount = tags.filter(t => allSelected.includes(t)).length;
                const carTotalTags = tags.length;
                const matchPercentage = carTotalTags > 0 ? matchCount / carTotalTags : 0;
                return { car, matchCount, carTotalTags, matchPercentage };
            });
        }

        // Debug information
        console.log('=== RESULTS DEBUG ===');
        console.log('Total cars in database:', this.carDatabase.length);
        console.log('User answers:', this.answers);
        console.log('Matched cars:', matchedCarsData.length);
        console.log('Match percentage:', this.carDatabase.length > 0 ? ((matchedCarsData.length / this.carDatabase.length) * 100).toFixed(1) + '%' : '0%');

        const totalMatches = matchedCarsData.length;

        this._fullMatchedCarsData = matchedCarsData.slice();
        this._resultsCurrentPage = 1;

        const paginationEl = document.getElementById('results-pagination');

        // Update results count display
        if (totalMatches === 0) {
            this._fullMatchedCarsData = null;
            this._resultsCurrentPage = 1;
            if (paginationEl) paginationEl.innerHTML = '';
            resultsCount.innerHTML = `
                <div class="count-display no-results">
                    <i class="fas fa-search"></i>
                    <span>No matches found</span>
                </div>
            `;
        } else {
            const pagedNote = totalMatches > RESULTS_PAGE_SIZE
                ? `<p class="results-cap-note">Showing <strong>${RESULTS_PAGE_SIZE}</strong> cars per page. Use the page numbers below (like Google) to see more matches.</p>`
                : '';
            const fallbackNote = this._lastResultsWereFallback
                ? `<p class="results-fallback-note"><i class="fas fa-info-circle" aria-hidden="true"></i> There were no vehicles that matched <strong>every</strong> filter. Below are up to <strong>${CLOSEST_FALLBACK_LIMIT}</strong> cars that align <strong>most closely</strong> with your answers. Try adjusting your choices and run the search again for a tighter match.</p>`
                : '';
            const countLabel = this._lastResultsWereFallback
                ? `Showing <strong>${totalMatches}</strong> closest ${totalMatches === 1 ? 'option' : 'options'}`
                : `Found <strong>${totalMatches}</strong> match${totalMatches === 1 ? '' : 'es'}`;
            resultsCount.innerHTML = `
                <div class="count-display${this._lastResultsWereFallback ? ' count-display--fallback' : ''}">
                    <i class="fas fa-check-circle"></i>
                    <span>${countLabel}</span>
                </div>
                ${fallbackNote}
                ${pagedNote}
            `;
        }

        if (totalMatches === 0) {
            resultsGrid.innerHTML = `
                <div class="no-results">
                    <i class="fas fa-search"></i>
                    <h3>No matches found</h3>
                    <p>Try adjusting your preferences or contact us for personalized assistance.</p>
                </div>
            `;
        } else {
            this.renderCurrentResultsPage();
            this.renderResultsPagination();
        }

        this.blockAccidentalHomeNavFor(1500);
        this.showScreen('results-screen');
    }

    showCarDetails(carId) {
        const car = this.carDatabase.find(c => c.id === carId);
        if (!car) {
            console.error('Car not found:', carId);
            return;
        }

        // Update car details screen
        document.getElementById('car-details-title').textContent = car.name;
        document.getElementById('car-details-price').textContent = `(${car.price})`;
        document.getElementById('car-details-description').textContent = car.description || '';
        document.getElementById('car-details-image').src = car.imageExterior;
        document.getElementById('car-details-image').alt = car.name;

        // Update features
        const featuresContainer = document.getElementById('car-details-features');
        featuresContainer.innerHTML = Array.from(ensureArray(car.features)).map(feature => 
            `<span class="feature-tag">${feature}</span>`
        ).join('');

        // Update detailed specifications (bulletproof for missing data)
        this.updateCarSpecifications(car);

        // Update detailed description
        this.updateDetailedDescription(car);

        // Update pros section
        this.updateProsSection(car);

        // Update YouTube section
        this.updateYouTubeSection(car);

        // Store current car for image switching
        this.currentCarDetails = car;

        this.showScreen('car-details-screen');
        // Ensure users land at the top of details on all browsers.
        const root = document.documentElement;
        const body = document.body;
        if (root) root.scrollTop = 0;
        if (body) body.scrollTop = 0;
        try {
            window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        } catch (_) {
            window.scrollTo(0, 0);
        }
    }

    updateCarSpecifications(car) {
        // Helper function to safely display data
        const safeDisplay = (value, fallback = 'Not specified') => {
            return value && value.trim() !== '' ? value : fallback;
        };

        // Helper function to parse and display pros
        const displayPros = (prosString) => {
            if (!prosString) return '';
            try {
                const pros = JSON.parse(prosString);
                return Array.isArray(pros) ? pros : [];
            } catch (e) {
                return [];
            }
        };

        const parseExpiryDate = (raw) => {
            if (raw == null || raw === '') return null;
            const d = new Date(raw);
            return Number.isNaN(d.getTime()) ? null : d;
        };

        const importExpiryHeadingAndPanel = `
                            <div class="import-expiry-heading-row">
                                <h5>IMPORT ELIGIBILITY EXPIRY</h5>
                                <button type="button" class="import-expiry-help-btn--inline" aria-expanded="false" aria-controls="import-expiry-help-panel" title="What does import eligibility expiry mean?" onclick="toggleImportExpiryHelp(event, this)">?</button>
                            </div>
                            <div id="import-expiry-help-panel" class="import-expiry-help-panel import-expiry-help-panel--inline" hidden>
                                <p>Australian import rules set a closing date for each model under the relevant vehicle import schemes. Until that date, the model may still be eligible to import. After the date, some models are approved again for import and others are not—so a particular vehicle may become permanently ineligible. Please confirm current eligibility with our team by clicking the Contact About This Car button at the bottom of the page.</p>
                            </div>`;

        const buildImportExpiryHtml = (raw) => {
            const parsed = parseExpiryDate(raw);
            if (!parsed) {
                return `
                    <div class="spec-item spec-item--import-expiry">
                        <i class="fas fa-calendar-check"></i>
                        <div class="spec-content">
                            ${importExpiryHeadingAndPanel}
                            <p class="import-expiry-plain">Not specified</p>
                        </div>
                    </div>`;
            }
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const exp = new Date(parsed);
            exp.setHours(0, 0, 0, 0);
            const active = exp >= today;
            const formatted = parsed.toLocaleDateString('en-AU', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });
            if (active) {
                return `
                    <div class="spec-item spec-item--import-expiry">
                        <i class="fas fa-calendar-check"></i>
                        <div class="spec-content">
                            ${importExpiryHeadingAndPanel}
                            <p class="import-expiry-date-line">${formatted}</p>
                            <span class="import-expiry-status import-expiry-status--active">Active</span>
                        </div>
                    </div>`;
            }
            return `
                <div class="spec-item spec-item--import-expiry">
                    <i class="fas fa-calendar-check"></i>
                    <div class="spec-content">
                        ${importExpiryHeadingAndPanel}
                        <p class="import-expiry-date-line">${formatted}</p>
                        <span class="import-expiry-status import-expiry-status--inactive">Inactive</span>
                        <p class="import-expiry-note import-expiry-note--inactive">Double-check with our staff for eligibility.</p>
                    </div>
                </div>`;
        };

        const importExpiryBlock = buildImportExpiryHtml(car.expiry_date);

        // Update specifications section
        const specsContainer = document.getElementById('car-specifications');
        if (specsContainer) {
            specsContainer.innerHTML = `
                <div class="spec-groups">
                    <div class="spec-group active">
                        <div class="spec-group-header" onclick="toggleSpecGroup(this)">
                            <h4><i class="fas fa-cog"></i>Engine & Performance</h4>
                            <i class="fas fa-chevron-down spec-group-toggle"></i>
                        </div>
                        <div class="spec-group-content">
                            <div class="specs-grid">
                                <div class="spec-item">
                                    <i class="fas fa-cog"></i>
                                    <div class="spec-content">
                                        <h5>ENGINE</h5>
                                        <p>${safeDisplay(car.engine_size)}</p>
                                    </div>
                                </div>
                                <div class="spec-item">
                                    <i class="fas fa-tachometer-alt"></i>
                                    <div class="spec-content">
                                        <h5>POWER</h5>
                                        <p>${safeDisplay(car.horsepower)}</p>
                                    </div>
                                </div>
                                <div class="spec-item">
                                    <i class="fas fa-bolt"></i>
                                    <div class="spec-content">
                                        <h5>TORQUE</h5>
                                        <p>${safeDisplay(car.torque)}</p>
                                    </div>
                                </div>
                                <div class="spec-item">
                                    <i class="fas fa-rocket"></i>
                                    <div class="spec-content">
                                        <h5>ACCELERATION</h5>
                                        <p>${safeDisplay(car.acceleration)}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="spec-group">
                        <div class="spec-group-header" onclick="toggleSpecGroup(this)">
                            <h4><i class="fas fa-cogs"></i>Transmission & Drivetrain</h4>
                            <i class="fas fa-chevron-down spec-group-toggle"></i>
                        </div>
                        <div class="spec-group-content">
                            <div class="specs-grid">
                                <div class="spec-item">
                                    <i class="fas fa-cogs"></i>
                                    <div class="spec-content">
                                        <h5>TRANSMISSION</h5>
                                        <p>${safeDisplay(car.transmission)}</p>
                                    </div>
                                </div>
                                <div class="spec-item">
                                    <i class="fas fa-car-side"></i>
                                    <div class="spec-content">
                                        <h5>DRIVETRAIN</h5>
                                        <p>${safeDisplay(car.drivetrain)}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="spec-group">
                        <div class="spec-group-header" onclick="toggleSpecGroup(this)">
                            <h4><i class="fas fa-ruler-combined"></i>Dimensions & Capacity</h4>
                            <i class="fas fa-chevron-down spec-group-toggle"></i>
                        </div>
                        <div class="spec-group-content">
                            <div class="specs-grid">
                                <div class="spec-item">
                                    <i class="fas fa-ruler-combined"></i>
                                    <div class="spec-content">
                                        <h5>DIMENSIONS</h5>
                                        <p>${safeDisplay(car.dimensions)}</p>
                                    </div>
                                </div>
                                <div class="spec-item">
                                    <i class="fas fa-users"></i>
                                    <div class="spec-content">
                                        <h5>SEATING</h5>
                                        <p>${safeDisplay(car.seating_capacity)}</p>
                                    </div>
                                </div>
                                <div class="spec-item">
                                    <i class="fas fa-box"></i>
                                    <div class="spec-content">
                                        <h5>BOOT SPACE</h5>
                                        <p>${safeDisplay(car.boot_size)}</p>
                                    </div>
                                </div>
                                <div class="spec-item">
                                    <i class="fas fa-truck"></i>
                                    <div class="spec-content">
                                        <h5>TOWING</h5>
                                        <p>${safeDisplay(car.towing_capacity)}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                                            <div class="spec-group">
                            <div class="spec-group-header" onclick="toggleSpecGroup(this)">
                                <h4><i class="fas fa-gas-pump"></i>Efficiency & Options</h4>
                                <i class="fas fa-chevron-down spec-group-toggle"></i>
                            </div>
                            <div class="spec-group-content">
                                <div class="specs-grid">
                                    <div class="spec-item">
                                        <i class="fas fa-gas-pump"></i>
                                        <div class="spec-content">
                                            <h5>FUEL ECONOMY</h5>
                                            <p>${safeDisplay(car.fuel_economy)}</p>
                                        </div>
                                    </div>
                                    <div class="spec-item">
                                        <i class="fas fa-star"></i>
                                        <div class="spec-content">
                                            <h5>AVAILABLE GRADES</h5>
                                            <p>${safeDisplay(car.available_grades)}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="spec-group">
                            <div class="spec-group-header" onclick="toggleSpecGroup(this)">
                                <h4><i class="fas fa-info-circle"></i>Additional Information</h4>
                                <i class="fas fa-chevron-down spec-group-toggle"></i>
                            </div>
                            <div class="spec-group-content">
                                <div class="specs-grid">
                                    ${importExpiryBlock}
                                    <div class="spec-item">
                                        <i class="fas fa-calendar-alt"></i>
                                        <div class="spec-content">
                                            <h5>YEAR RANGE</h5>
                                            <p>${safeDisplay(car.year_range)}</p>
                                        </div>
                                    </div>
                                    <div class="spec-item">
                                        <i class="fas fa-layer-group"></i>
                                        <div class="spec-content">
                                            <h5>GENERATION</h5>
                                            <p>${safeDisplay(car.generation)}</p>
                                        </div>
                                    </div>
                                    <div class="spec-item">
                                        <i class="fas fa-shield-alt"></i>
                                        <div class="spec-content">
                                            <h5>SAFETY RATING</h5>
                                            <p>${safeDisplay(car.safety_rating)}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                </div>
            `;
        }

        // Update detailed description
        const detailedDescContainer = document.getElementById('car-detailed-description');
        if (detailedDescContainer) {
            detailedDescContainer.innerHTML = `
                <h4>Detailed Description</h4>
                <p>${safeDisplay(car.detailed_description, 'Detailed description coming soon...')}</p>
            `;
        }

        // Update pros section
        const prosContainer = document.getElementById('car-pros');
        if (prosContainer) {
            const pros = displayPros(car.pros);
            if (pros.length > 0) {
                prosContainer.innerHTML = `
                    <h4>Key Benefits</h4>
                    <ul class="pros-list">
                        ${pros.map(pro => `<li><i class="fas fa-check"></i> ${pro}</li>`).join('')}
                    </ul>
                `;
            } else {
                prosContainer.innerHTML = `
                    <h4>Key Benefits</h4>
                    <p>Benefits information coming soon...</p>
                `;
            }
        }

        // Update YouTube section
        const youtubeContainer = document.getElementById('car-youtube');
        if (youtubeContainer && car.youtube_search_query) {
            youtubeContainer.innerHTML = `
                <h4>Watch Videos</h4>
                <div class="youtube-section">
                    <p>Search for videos about this car:</p>
                    <div class="youtube-search">
                        <input type="text" value="${car.youtube_search_query}" readonly>
                        <button onclick="searchYouTube('${car.youtube_search_query}')">
                            <i class="fab fa-youtube"></i>
                            Search YouTube
                        </button>
                    </div>
                </div>
            `;
        } else if (youtubeContainer) {
            youtubeContainer.innerHTML = `
                <h4>Watch Videos</h4>
                <p>Video search coming soon...</p>
            `;
        }
    }

    updateDetailedDescription(car) {
        const descriptionContainer = document.getElementById('car-detailed-description');
        if (descriptionContainer && car.detailed_description) {
            descriptionContainer.innerHTML = `
                <h4>Detailed Description</h4>
                <div class="detailed-description-content">
                    ${car.detailed_description}
                </div>
            `;
        } else if (descriptionContainer) {
            descriptionContainer.innerHTML = `
                <h4>Detailed Description</h4>
                <p>Detailed description coming soon...</p>
            `;
        }
    }

    updateProsSection(car) {
        const prosContainer = document.getElementById('car-pros');
        if (prosContainer && car.pros) {
            const pros = Array.isArray(car.pros) ? car.pros : [];
            if (pros.length > 0) {
                prosContainer.innerHTML = `
                    <h4>Key Benefits</h4>
                    <ul class="pros-list">
                        ${pros.map(pro => `<li><i class="fas fa-check"></i> ${pro}</li>`).join('')}
                    </ul>
                `;
            } else {
                prosContainer.innerHTML = `
                    <h4>Key Benefits</h4>
                    <p>Benefits information coming soon...</p>
                `;
            }
        } else if (prosContainer) {
            prosContainer.innerHTML = `
                <h4>Key Benefits</h4>
                <p>Benefits information coming soon...</p>
            `;
        }
    }

    updateYouTubeSection(car) {
        const youtubeContainer = document.getElementById('car-youtube');
        if (youtubeContainer && car.youtube_search_query) {
            youtubeContainer.innerHTML = `
                <h4>Watch Videos</h4>
                <div class="youtube-section">
                    <p>Search for videos about this car:</p>
                    <div class="youtube-search">
                        <input type="text" value="${car.youtube_search_query}" readonly>
                        <button onclick="searchYouTube('${car.youtube_search_query}')">
                            <i class="fab fa-youtube"></i>
                            Search YouTube
                        </button>
                    </div>
                </div>
            `;
        } else if (youtubeContainer) {
            youtubeContainer.innerHTML = `
                <h4>Watch Videos</h4>
                <p>Video search coming soon...</p>
            `;
        }
    }

    switchCarImage(imageType) {
        if (!this.currentCarDetails) return;

        const imageElement = document.getElementById('car-details-image');
        if (imageType === 'exterior') {
            imageElement.src = this.currentCarDetails.imageExterior;
        } else if (imageType === 'interior') {
            imageElement.src = this.currentCarDetails.imageInterior;
        }
    }

    restartCarFinder() {
        this.currentQuestion = 0;
        this.answers = {};
        this._fullMatchedCarsData = null;
        this._resultsCurrentPage = 1;
        this._lastResultsWereFallback = false;
        const paginationEl = document.getElementById('results-pagination');
        if (paginationEl) paginationEl.innerHTML = '';
        this.updateCarPreview();
        this.showScreen('welcome-screen');
    }

    startCarInquiry() {
        this.showScreen('inquiry-screen');
        this.inquiryStep = 1;
        const form = document.getElementById('car-inquiry-form');
        if (form) {
            form.reset();
            document.getElementById('manual-input-section').style.display = 'none';
            document.getElementById('dropdown-section').style.display = 'none';
            document.getElementById('other-make-group').style.display = 'none';
            document.getElementById('other-model-group').style.display = 'none';
        }
        this.hideInquirySelectedCarCard();
        this.populateRangeDropdowns();
        this.updateYearToDropdown();
        this.updateMileageToDropdown();
        this.populateMakeDropdown();
        const modelSelect = document.getElementById('car-model');
        if (modelSelect) {
            modelSelect.innerHTML = '<option value="">Select Model</option>';
        }
        this.updateOtherCarFields();
        this.showInquiryStep(1);
        this.updateInquiryProgress(1);
        this.updateInquiryImportExpiryBlock();
    }

    showInquiryStep(step) {
        this.inquiryStep = step;
        document.querySelectorAll('.inquiry-step').forEach(el => {
            el.classList.toggle('active', parseInt(el.getAttribute('data-inquiry-step'), 10) === step);
        });
        document.querySelectorAll('.inquiry-dot').forEach((el, i) => {
            el.classList.toggle('active', i + 1 <= step);
        });
        this.updateInquiryProgress(step);
    }

    updateInquiryProgress(step) {
        const fill = document.getElementById('inquiry-progress-fill');
        if (fill) {
            fill.style.width = `${((step - 1) / (this.inquiryTotalSteps - 1)) * 100}%`;
        }
    }

    nextInquiryStep() {
        if (this.inquiryStep === 1) {
            const age = document.querySelector('input[name="car_age"]:checked');
            if (!age) {
                alert('Please select whether the car is 25+ years or newer.');
                return;
            }
            if (age.value === '25_plus') {
                const make = document.getElementById('manual-car-make');
                const model = document.getElementById('manual-car-model');
                if (!make?.value?.trim() || !model?.value?.trim()) {
                    alert('Please enter make and model.');
                    return;
                }
            } else {
                const selection = this.getEffectiveNewerSelection();
                if (!selection.make || !selection.model) {
                    alert('Please select make and model.');
                    return;
                }
            }
        }
        if (this.inquiryStep === 2) {
            const inquiryForm = document.getElementById('car-inquiry-form');
            const seriousness = inquiryForm?.querySelector('input[name="inquiry_seriousness"]:checked');
            if (!seriousness) {
                alert('Please let us know where you are in your buying journey.');
                return;
            }
        }
        if (this.inquiryStep < this.inquiryTotalSteps) {
            this.showInquiryStep(this.inquiryStep + 1);
        }
    }

    prevInquiryStep() {
        if (this.inquiryStep > 1) {
            this.showInquiryStep(this.inquiryStep - 1);
        }
    }

    findCarByMakeAndModel(makeValue, modelValue) {
        if (!makeValue || !modelValue || !this.carDatabase.length) return null;
        const expectedName = `${makeValue} ${modelValue}`.trim().toLowerCase();
        return this.carDatabase.find(car => {
            if (!car.name) return false;
            return car.name.trim().toLowerCase() === expectedName;
        }) || null;
    }

    parseExpiryDateValue(raw) {
        if (raw == null || raw === '') return null;
        const d = new Date(raw);
        return Number.isNaN(d.getTime()) ? null : d;
    }

    getImportExpiryHelpParagraphHtml() {
        return 'Australian import rules set a closing date for each model under the relevant vehicle import schemes. Until that date, the model may still be eligible to import. After the date, some models are approved again for import and others are not—so a particular vehicle may become permanently ineligible. Please confirm current eligibility with our team by clicking the Contact About This Car button at the bottom of the page.';
    }

    buildInquiryImportExpiryMarkup(expiryRaw) {
        const helpId = 'inquiry-import-expiry-help-panel';
        const heading = `
            <div class="import-expiry-heading-row inquiry-import-expiry-heading-row">
                <span class="inquiry-import-expiry-title">Import eligibility expiry</span>
                <button type="button" class="import-expiry-help-btn--inline" aria-expanded="false" aria-controls="${helpId}" title="What does import eligibility expiry mean?" onclick="toggleInquiryImportExpiryHelp(event, this)">?</button>
            </div>
            <div id="${helpId}" class="import-expiry-help-panel import-expiry-help-panel--inline inquiry-import-expiry-help" hidden>
                <p>${this.getImportExpiryHelpParagraphHtml()}</p>
            </div>`;
        const parsed = this.parseExpiryDateValue(expiryRaw);
        if (!parsed) {
            return `
                <div class="inquiry-import-expiry-inner">
                    <i class="fas fa-calendar-check inquiry-import-expiry-icon" aria-hidden="true"></i>
                    <div class="inquiry-import-expiry-main">
                        ${heading}
                        <p class="inquiry-import-expiry-line inquiry-import-expiry-line--muted">Not specified</p>
                    </div>
                </div>`;
        }
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const exp = new Date(parsed);
        exp.setHours(0, 0, 0, 0);
        const active = exp >= today;
        const formatted = parsed.toLocaleDateString('en-AU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
        if (active) {
            return `
                <div class="inquiry-import-expiry-inner">
                    <i class="fas fa-calendar-check inquiry-import-expiry-icon" aria-hidden="true"></i>
                    <div class="inquiry-import-expiry-main">
                        ${heading}
                        <p class="inquiry-import-expiry-line">${formatted}</p>
                        <span class="import-expiry-status import-expiry-status--active">Active</span>
                    </div>
                </div>`;
        }
        return `
            <div class="inquiry-import-expiry-inner">
                <i class="fas fa-calendar-check inquiry-import-expiry-icon" aria-hidden="true"></i>
                <div class="inquiry-import-expiry-main">
                    ${heading}
                    <p class="inquiry-import-expiry-line">${formatted}</p>
                    <span class="import-expiry-status import-expiry-status--inactive">Inactive</span>
                    <p class="import-expiry-note import-expiry-note--inactive">Double-check with our staff for eligibility.</p>
                </div>
            </div>`;
    }

    updateInquiryImportExpiryBlock() {
        const block = document.getElementById('inquiry-import-expiry-block');
        if (!block) return;
        const age = document.querySelector('#car-inquiry-form input[name="car_age"]:checked');
        const modelSelect = document.getElementById('car-model');
        const rawModel = modelSelect?.value ?? '';

        if (!age || age.value !== 'newer' || !rawModel) {
            block.setAttribute('hidden', '');
            block.innerHTML = '';
            return;
        }

        const selection = this.getEffectiveNewerSelection();
        if (selection.isOther && (!selection.make || !selection.model)) {
            block.removeAttribute('hidden');
            block.innerHTML = this.buildInquiryImportExpiryMarkup(null);
            return;
        }

        const car = this.findCarByMakeAndModel(selection.make, selection.model);
        const expiryRaw = car?.expiry_date ?? null;
        block.removeAttribute('hidden');
        block.innerHTML = this.buildInquiryImportExpiryMarkup(expiryRaw);
    }

    updateInquirySelectedCarPreview() {
        try {
            const age = document.querySelector('input[name="car_age"]:checked');
            if (!age || age.value !== 'newer') {
                this.hideInquirySelectedCarCard();
                return;
            }
            const selection = this.getEffectiveNewerSelection();
            if (selection.isOther) {
                this.hideInquirySelectedCarCard();
                return;
            }
            const car = this.findCarByMakeAndModel(selection.make, selection.model);
            const card = document.getElementById('inquiry-selected-car-card');
            if (!card) return;
            if (!car) {
                this.hideInquirySelectedCarCard();
                return;
            }
            const img = document.getElementById('inquiry-selected-car-image');
            const nameEl = document.getElementById('inquiry-selected-car-name');
            const priceEl = document.getElementById('inquiry-selected-car-price');
            if (img) img.src = car.imageExterior || '';
            if (img) img.alt = car.name || '';
            if (nameEl) nameEl.textContent = car.name || '';
            if (priceEl) priceEl.textContent = car.price || '';
            card.style.display = 'block';
        } finally {
            this.updateInquiryImportExpiryBlock();
        }
    }

    hideInquirySelectedCarCard() {
        const card = document.getElementById('inquiry-selected-car-card');
        if (card) card.style.display = 'none';
    }

    openContactCarModal(car) {
        if (!car || !car.name) return;
        const parts = car.name.trim().split(/\s+/);
        const make = parts.length >= 1 ? parts[0] : '';
        const model = parts.length >= 2 ? parts.slice(1).join(' ') : '';
        document.getElementById('contact-modal-car-age').value = 'newer';
        document.getElementById('contact-modal-car-make').value = make;
        document.getElementById('contact-modal-car-model').value = model;
        document.getElementById('contact-car-modal-title').textContent = 'Inquire about this car';
        document.getElementById('contact-car-modal-car-info').textContent = `${car.name}${car.price ? ' · ' + car.price : ''}`;
        const form = document.getElementById('contact-car-form');
        if (form) form.reset();
        document.getElementById('contact-modal-car-age').value = 'newer';
        document.getElementById('contact-modal-car-make').value = make;
        document.getElementById('contact-modal-car-model').value = model;
        this.populateContactModalRanges(car);
        const modal = document.getElementById('contact-car-modal');
        if (modal) {
            modal.setAttribute('aria-hidden', 'false');
        }
    }

    closeContactCarModal() {
        const modal = document.getElementById('contact-car-modal');
        if (modal) {
            modal.setAttribute('aria-hidden', 'true');
        }
    }

    showInquirySuccessScreen() {
        this.closeContactCarModal();
        this.showScreen('inquiry-success-screen');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    populateContactModalRanges(car) {
        const currentYear = new Date().getFullYear();
        const limitedYears = this.parseYearRange(car?.year_range);
        const yearOptions = Array.isArray(limitedYears) && limitedYears.length > 0
            ? limitedYears
            : Array.from({ length: currentYear - 1989 }, (_, i) => currentYear - i);
        const yearFrom = document.getElementById('contact-modal-year-from');
        const yearTo = document.getElementById('contact-modal-year-to');
        if (yearFrom && yearTo) {
            yearFrom.innerHTML = '<option value="">From</option>';
            yearTo.innerHTML = '<option value="">To</option>';
            yearOptions.forEach(y => {
                yearFrom.appendChild(new Option(String(y), String(y)));
                yearTo.appendChild(new Option(String(y), String(y)));
            });
        }
        const mileageOpts = [
            { value: 0, label: '0' }, { value: 10000, label: '10,000' }, { value: 20000, label: '20,000' },
            { value: 30000, label: '30,000' }, { value: 50000, label: '50,000' }, { value: 75000, label: '75,000' },
            { value: 100000, label: '100,000' }, { value: 150000, label: '150,000' }, { value: 200000, label: '200,000' },
            { value: 250000, label: '250,000' }, { value: 300000, label: '300,000+' }
        ];
        const mileageFrom = document.getElementById('contact-modal-mileage-from');
        const mileageTo = document.getElementById('contact-modal-mileage-to');
        if (mileageFrom && mileageTo) {
            mileageFrom.innerHTML = '<option value="">From</option>';
            mileageTo.innerHTML = '<option value="">To</option>';
            mileageOpts.forEach(o => {
                mileageFrom.appendChild(new Option(o.label, String(o.value)));
                mileageTo.appendChild(new Option(o.label, String(o.value)));
            });
        }
    }

    async submitContactCarFormInquiry(formData) {
        try {
            const { error } = await this.supabase
                .from('car_inquiries')
                .insert({
                    car_age: formData.car_age || null,
                    manual_car_make: formData.manual_car_make || null,
                    manual_car_model: formData.manual_car_model || null,
                    car_make: formData.car_make || null,
                    car_model: formData.car_model || null,
                    trim_level: formData.trim_level || null,
                    mileage_from: formData.mileage_from || null,
                    mileage_to: formData.mileage_to || null,
                    color: formData.color || null,
                    year_from: formData.year_from || null,
                    year_to: formData.year_to || null,
                    options: formData.options || null,
                    other_requirements: formData.other_requirements || null,
                    inquiry_seriousness: formData.inquiry_seriousness || null,
                    contact_name: formData.contact_name || null,
                    contact_email: formData.contact_email || null,
                    contact_phone: formData.contact_phone || null
                });
            if (error) throw error;
            return true;
        } catch (err) {
            console.error('Contact car inquiry insert error:', err);
            return false;
        }
    }

    populateRangeDropdowns() {
        // Populate year dropdowns (from current year back to 1990)
        const currentYear = new Date().getFullYear();
        const yearFromSelect = document.getElementById('year-from');
        const yearToSelect = document.getElementById('year-to');
        
        if (yearFromSelect && yearToSelect) {
            // Store all year options for filtering
            this.defaultInquiryYearOptions = [];
            
            // Clear existing options except "Not specified"
            yearFromSelect.innerHTML = '<option value="">Not specified</option>';
            yearToSelect.innerHTML = '<option value="">Not specified</option>';
            
            // Add years from current year down to 1990
            for (let year = currentYear; year >= 1990; year--) {
                this.defaultInquiryYearOptions.push(year);
                
                const optionFrom = document.createElement('option');
                optionFrom.value = year;
                optionFrom.textContent = year;
                yearFromSelect.appendChild(optionFrom);
                
                const optionTo = document.createElement('option');
                optionTo.value = year;
                optionTo.textContent = year;
                yearToSelect.appendChild(optionTo);
            }
            
            // Add event listener to update "to" dropdown when "from" changes
            yearFromSelect.addEventListener('change', () => {
                this.updateYearToDropdown();
            });

            this.allYearOptions = [...this.defaultInquiryYearOptions];
        }

        // Populate mileage dropdowns (in increments)
        const mileageFromSelect = document.getElementById('mileage-from');
        const mileageToSelect = document.getElementById('mileage-to');
        
        if (mileageFromSelect && mileageToSelect) {
            // Store all mileage options for filtering
            this.allMileageOptions = [
                { value: 0, label: '0' },
                { value: 10000, label: '10,000' },
                { value: 20000, label: '20,000' },
                { value: 30000, label: '30,000' },
                { value: 50000, label: '50,000' },
                { value: 75000, label: '75,000' },
                { value: 100000, label: '100,000' },
                { value: 150000, label: '150,000' },
                { value: 200000, label: '200,000' },
                { value: 250000, label: '250,000' },
                { value: 300000, label: '300,000+' }
            ];
            
            // Clear existing options except "Not specified"
            mileageFromSelect.innerHTML = '<option value="">Not specified</option>';
            mileageToSelect.innerHTML = '<option value="">Not specified</option>';
            
            // Add mileage options
            this.allMileageOptions.forEach(option => {
                const optionFrom = document.createElement('option');
                optionFrom.value = option.value;
                optionFrom.textContent = option.label;
                mileageFromSelect.appendChild(optionFrom);
                
                const optionTo = document.createElement('option');
                optionTo.value = option.value;
                optionTo.textContent = option.label;
                mileageToSelect.appendChild(optionTo);
            });
            
            // Add event listener to update "to" dropdown when "from" changes
            mileageFromSelect.addEventListener('change', () => {
                this.updateMileageToDropdown();
            });
        }
    }

    updateYearToDropdown() {
        const yearFromSelect = document.getElementById('year-from');
        const yearToSelect = document.getElementById('year-to');
        
        if (!yearFromSelect || !yearToSelect || !this.allYearOptions) return;
        
        const selectedFromValue = yearFromSelect.value;
        const currentToValue = yearToSelect.value;
        
        // Clear and rebuild "to" dropdown
        yearToSelect.innerHTML = '<option value="">Not specified</option>';
        
        if (selectedFromValue === '') {
            // If "from" is not specified, show all years
            this.allYearOptions.forEach(year => {
                const option = document.createElement('option');
                option.value = year;
                option.textContent = year;
                yearToSelect.appendChild(option);
            });
        } else {
            // Only show years >= selected "from" year
            const fromYear = parseInt(selectedFromValue);
            this.allYearOptions.forEach(year => {
                if (year >= fromYear) {
                    const option = document.createElement('option');
                    option.value = year;
                    option.textContent = year;
                    yearToSelect.appendChild(option);
                }
            });
            
            // If current "to" value is invalid, reset it
            if (currentToValue && parseInt(currentToValue) < fromYear) {
                yearToSelect.value = '';
            } else if (currentToValue) {
                yearToSelect.value = currentToValue;
            }
        }
    }

    updateMileageToDropdown() {
        const mileageFromSelect = document.getElementById('mileage-from');
        const mileageToSelect = document.getElementById('mileage-to');
        
        if (!mileageFromSelect || !mileageToSelect || !this.allMileageOptions) return;
        
        const selectedFromValue = mileageFromSelect.value;
        const currentToValue = mileageToSelect.value;
        
        // Clear and rebuild "to" dropdown
        mileageToSelect.innerHTML = '<option value="">Not specified</option>';
        
        if (selectedFromValue === '') {
            // If "from" is not specified, show all mileage options
            this.allMileageOptions.forEach(option => {
                const optionElement = document.createElement('option');
                optionElement.value = option.value;
                optionElement.textContent = option.label;
                mileageToSelect.appendChild(optionElement);
            });
        } else {
            // Only show mileage values >= selected "from" value
            const fromMileage = parseInt(selectedFromValue);
            this.allMileageOptions.forEach(option => {
                if (option.value >= fromMileage) {
                    const optionElement = document.createElement('option');
                    optionElement.value = option.value;
                    optionElement.textContent = option.label;
                    mileageToSelect.appendChild(optionElement);
                }
            });
            
            // If current "to" value is invalid, reset it
            if (currentToValue && parseInt(currentToValue) < fromMileage) {
                mileageToSelect.value = '';
            } else if (currentToValue) {
                mileageToSelect.value = currentToValue;
            }
        }
    }

    handleAgeSelection(ageValue) {
        const manualSection = document.getElementById('manual-input-section');
        const dropdownSection = document.getElementById('dropdown-section');
        const manualMakeInput = document.getElementById('manual-car-make');
        const manualModelInput = document.getElementById('manual-car-model');
        const makeSelect = document.getElementById('car-make');
        const modelSelect = document.getElementById('car-model');

        if (ageValue === '25_plus') {
            manualSection.style.display = 'block';
            dropdownSection.style.display = 'none';
            if (manualMakeInput) manualMakeInput.required = true;
            if (manualModelInput) manualModelInput.required = true;
            if (makeSelect) makeSelect.required = false;
            if (modelSelect) modelSelect.required = false;
            this.updateOtherCarFields();
            this.hideInquirySelectedCarCard();
            this.setInquiryYearOptions(this.defaultInquiryYearOptions);
        } else if (ageValue === 'newer') {
            manualSection.style.display = 'none';
            dropdownSection.style.display = 'block';
            if (makeSelect) makeSelect.required = true;
            if (modelSelect) modelSelect.required = true;
            if (manualMakeInput) manualMakeInput.required = false;
            if (manualModelInput) manualModelInput.required = false;
            this.bindInquiryModelChangeOnce();
            this.updateOtherCarFields();
            this.applySelectedCarYearRange();
            this.updateInquirySelectedCarPreview();
        }
    }

    bindInquiryModelChangeOnce() {
        const modelSelect = document.getElementById('car-model');
        if (!modelSelect || modelSelect.dataset.inquiryPreviewBound === 'true') return;
        modelSelect.addEventListener('change', () => {
            this.updateOtherCarFields();
            this.applySelectedCarYearRange();
            this.updateInquirySelectedCarPreview();
        });
        modelSelect.dataset.inquiryPreviewBound = 'true';

        ['other-car-make', 'other-car-model'].forEach(id => {
            const el = document.getElementById(id);
            if (!el || el.dataset.inquiryExpiryBound === 'true') return;
            el.addEventListener('input', () => {
                this.updateOtherCarFields();
                this.applySelectedCarYearRange();
                this.updateInquirySelectedCarPreview();
            });
            el.dataset.inquiryExpiryBound = 'true';
        });
    }

    async submitCarInquiry(formData) {
        try {
            const { error } = await this.supabase
                .from('car_inquiries')
                .insert({
                    car_age: formData.car_age || null,
                    manual_car_make: formData.manual_car_make || null,
                    manual_car_model: formData.manual_car_model || null,
                    car_make: formData.car_make || null,
                    car_model: formData.car_model || null,
                    trim_level: formData.trim_level || null,
                    mileage_from: formData.mileage_from || null,
                    mileage_to: formData.mileage_to || null,
                    color: formData.color || null,
                    year_from: formData.year_from || null,
                    year_to: formData.year_to || null,
                    options: formData.options || null,
                    other_requirements: formData.other_requirements || null,
                    inquiry_seriousness: formData.inquiry_seriousness || null,
                    contact_name: formData.contact_name || null,
                    contact_email: formData.contact_email || null,
                    contact_phone: formData.contact_phone || null
                });

            if (error) {
                console.error('Supabase insert error:', error);
                alert('Sorry, we couldn\'t send your inquiry right now. Please try again or contact us directly.');
                return;
            }

            this.showInquirySuccessScreen();
        } catch (err) {
            console.error('Car inquiry submit error:', err);
            alert('Sorry, something went wrong. Please try again or contact us directly.');
        }
    }
}

// Global functions for button clicks
function startCarFinder() {
    carFinder.startCarFinder();
}

function nextQuestion(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    carFinder.nextQuestion();
}

function restartCarFinder() {
    carFinder.restartCarFinder();
}

function contactUs() {
    // You can customize this to open your contact form or phone number
    window.open('tel:+6140856355', '_self');
}

function viewCarDetails(carId) {
    carFinder.showCarDetails(carId);
}

function contactAboutCar(carId) {
    const car = carFinder.carDatabase.find(c => c.id === carId);
    if (car) carFinder.openContactCarModal(car);
}

function closeContactCarModal() {
    carFinder.closeContactCarModal();
}

function submitContactCarForm(event) {
    event.preventDefault();
    const form = document.getElementById('contact-car-form');
    const fd = new FormData(form);
    const inquiryData = {
        car_age: fd.get('car_age') || 'newer',
        manual_car_make: null,
        manual_car_model: null,
        car_make: fd.get('car_make') || null,
        car_model: fd.get('car_model') || null,
        trim_level: fd.get('trim_level') || null,
        mileage_from: fd.get('mileage_from') || null,
        mileage_to: fd.get('mileage_to') || null,
        color: fd.get('color') || null,
        year_from: fd.get('year_from') || null,
        year_to: fd.get('year_to') || null,
        options: fd.get('options') || null,
        other_requirements: fd.get('other_requirements') || null,
        inquiry_seriousness: fd.get('inquiry_seriousness') || null,
        contact_name: fd.get('contact_name') || null,
        contact_email: fd.get('contact_email') || null,
        contact_phone: fd.get('contact_phone') || null
    };
    carFinder.submitContactCarFormInquiry(inquiryData).then(success => {
        if (success) {
            carFinder.showInquirySuccessScreen();
        } else {
            alert('Sorry, we couldn\'t send your inquiry right now. Please try again or contact us directly.');
        }
    });
}

function goBackToResults() {
    carFinder.showScreen('results-screen');
}

function switchImageTab(imageType, event) {
    carFinder.switchCarImage(imageType);
    
    // Update tab states
    document.querySelectorAll('.image-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    const clickedTab = event?.currentTarget || event?.target?.closest('.image-tab');
    if (clickedTab) {
        clickedTab.classList.add('active');
    }
}

function contactAboutCarFromDetails() {
    if (carFinder.currentCarDetails) {
        carFinder.openContactCarModal(carFinder.currentCarDetails);
    }
}

function searchYouTube(query) {
    // Open YouTube search in a new tab
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    window.open(searchUrl, '_blank');
}

function toggleSpecGroup(headerElement) {
    const specGroup = headerElement.closest('.spec-group');
    const isActive = specGroup.classList.contains('active');
    
    // Toggle current group only
    if (isActive) {
        specGroup.classList.remove('active');
    } else {
        specGroup.classList.add('active');
    }
}

function toggleImportExpiryHelp(event, button) {
    event.stopPropagation();
    const specGroup = button.closest('.spec-group');
    if (specGroup && !specGroup.classList.contains('active')) {
        specGroup.classList.add('active');
    }
    const panel = document.getElementById('import-expiry-help-panel');
    if (!panel) return;
    const isHidden = panel.hasAttribute('hidden');
    if (isHidden) {
        panel.removeAttribute('hidden');
        button.setAttribute('aria-expanded', 'true');
    } else {
        panel.setAttribute('hidden', '');
        button.setAttribute('aria-expanded', 'false');
    }
}

function toggleInquiryImportExpiryHelp(event, button) {
    event.preventDefault();
    event.stopPropagation();
    const panel = document.getElementById('inquiry-import-expiry-help-panel');
    if (!panel) return;
    const isHidden = panel.hasAttribute('hidden');
    if (isHidden) {
        panel.removeAttribute('hidden');
        button.setAttribute('aria-expanded', 'true');
    } else {
        panel.setAttribute('hidden', '');
        button.setAttribute('aria-expanded', 'false');
    }
}

// Inquiry functions
function startCarInquiry() {
    carFinder.startCarInquiry();
}

function nextInquiryStep() {
    carFinder.nextInquiryStep();
}

function prevInquiryStep() {
    carFinder.prevInquiryStep();
}

function handleAgeSelection(ageValue) {
    carFinder.handleAgeSelection(ageValue);
}

function goBackToWelcome() {
    if (!carFinder.canNavigateHomeNow()) {
        return;
    }
    carFinder.restartCarFinder();
}

function goToResultsPage(event, page) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    carFinder.goToResultsPage(page);
}

function submitCarInquiry(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    const rawMake = formData.get('car_make');
    const rawModel = formData.get('car_model');
    const effectiveNewerMake = rawMake === 'other'
        ? (formData.get('other_car_make') || '').trim()
        : rawMake;
    const effectiveNewerModel = rawModel === 'other'
        ? (formData.get('other_car_model') || '').trim()
        : rawModel;
    
    // Convert FormData to object
    const inquiryData = {
        car_age: formData.get('car_age'),
        manual_car_make: formData.get('manual_car_make'),
        manual_car_model: formData.get('manual_car_model'),
        car_make: effectiveNewerMake,
        car_model: effectiveNewerModel,
        trim_level: formData.get('trim_level'),
        mileage_from: formData.get('mileage_from'),
        mileage_to: formData.get('mileage_to'),
        color: formData.get('color'),
        year_from: formData.get('year_from'),
        year_to: formData.get('year_to'),
        options: formData.get('options'),
        other_requirements: formData.get('other_requirements'),
        inquiry_seriousness: formData.get('inquiry_seriousness'),
        contact_name: formData.get('contact_name'),
        contact_email: formData.get('contact_email'),
        contact_phone: formData.get('contact_phone')
    };
    
    // Validate based on age selection
    if (inquiryData.car_age === '25_plus') {
        if (!inquiryData.manual_car_make || inquiryData.manual_car_make.trim() === '' ||
            !inquiryData.manual_car_model || inquiryData.manual_car_model.trim() === '') {
            alert('Please specify both make and model for the car you are looking for.');
            return;
        }
        inquiryData.car_make = null;
        inquiryData.car_model = null;
    } else if (inquiryData.car_age === 'newer') {
        if (!inquiryData.car_make || !inquiryData.car_model) {
            alert('Please select both make and model.');
            return;
        }
        inquiryData.manual_car_make = null;
        inquiryData.manual_car_model = null;
    }
    
    // Submit the inquiry
    carFinder.submitCarInquiry(inquiryData);
}

// Initialize the application
let carFinder;
document.addEventListener('DOMContentLoaded', () => {
    carFinder = new CarFinder();
}); 