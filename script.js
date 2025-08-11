document.addEventListener('DOMContentLoaded', () => {

    // --- SUPABASE CLIENT INITIALIZATION ---
    const SUPABASE_URL = 'https://ennlvlcogzowropkwbiu.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVubmx2bGNvZ3pvd3JvcGt3Yml1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5MTIyMTAsImV4cCI6MjA2OTQ4ODIxMH0.dCsyTAsAhcvSpeUMxWSyo_9praZC2wPDzmb3vCkHpPc';
    
    const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // --- GLOBAL STATE ---
    let currentUserState = {
        isLoggedIn: false,
        userId: null,
        joinedTableId: null,
        waitlistedTableIds: [],
        isSuspended: false,
        suspensionEndDate: null
    };
    let activeDate = '';
    let selectedTableId = null;

    // --- DOM ELEMENT REFERENCES ---
    const dayTabsContainer = document.getElementById('day-tabs');
    const tablesContainer = document.getElementById('tables-container');
    const loadingSpinner = document.getElementById('loading-spinner');
    const noTablesMessage = document.getElementById('no-tables-message');
    const userStatusDiv = document.getElementById('user-status');
    const userGreetingSpan = document.getElementById('user-greeting');
    const logoutLink = document.getElementById('logout-link');
    const loginButton = document.getElementById('login-button');
    
    // Join Modal elements
    const joinModal = document.getElementById('join-modal');
    const joinModalContent = document.getElementById('modal-content');
    const modalStep1 = document.getElementById('modal-step-1');
    const modalStep3 = document.getElementById('modal-step-3');
    const modalTableDetails = document.getElementById('modal-table-details');
    const joinModalTitle = document.getElementById('join-modal-title');
    const joinSubmitButton = document.getElementById('join-submit-button');
    const successTitle = document.getElementById('success-title');
    const successMessage = document.getElementById('success-message');
    const disclaimerCheckbox = document.getElementById('disclaimer-checkbox');
    const marketingCheckbox = document.getElementById('marketing-checkbox');

    // Auth Modal elements
    const authModal = document.getElementById('auth-modal');
    const authLoginStep = document.getElementById('auth-login-step');
    const authSignupStep = document.getElementById('auth-signup-step');
    const authLoginForm = document.getElementById('auth-login-form');
    const authSignupForm = document.getElementById('auth-signup-form');
    const authLoginError = document.getElementById('auth-login-error');
    const authSignupError = document.getElementById('auth-signup-error');
    const authSignupSubmit = document.getElementById('auth-signup-submit');
    const closeAuthModal = document.getElementById('close-auth-modal');
    const switchToSignup = document.getElementById('switch-to-signup');
    const switchToLogin = document.getElementById('switch-to-login');
    
    // Email verification modal
    const emailVerificationModal = document.getElementById('email-verification-modal');
    const closeEmailVerification = document.getElementById('close-email-verification');
    const resendVerification = document.getElementById('resend-verification');
    const resendStatus = document.getElementById('resend-status');

    // Request Modal elements
    const requestTableBtn = document.getElementById('request-table-btn');
    const requestModal = document.getElementById('request-modal');
    const requestModalContent = document.getElementById('request-modal-content');
    const requestStep1 = document.getElementById('request-step-1');
    const requestStep2 = document.getElementById('request-step-2');
    const requestInfoForm = document.getElementById('request-info-form');
    const requestFormError = document.getElementById('request-form-error');
    const requestDisclaimerCheckbox = document.getElementById('request-disclaimer-checkbox');
    const requestSubmitButton = document.getElementById('request-submit-button');
    const closeRequestModal1 = document.getElementById('close-request-modal-1');
    const closeRequestModal2 = document.getElementById('close-request-modal-2');

    // Forms and buttons
    const userInfoForm = document.getElementById('user-info-form');
    const formError1 = document.getElementById('form-error-1');
    const closeButton1 = document.getElementById('close-modal-1');
    const closeButton3 = document.getElementById('close-modal-3');

    // --- CORE FUNCTIONS ---

    const renderTables = async (dateString) => {
        tablesContainer.innerHTML = '';
        loadingSpinner.classList.remove('hidden');
        noTablesMessage.classList.add('hidden');

        const { data: filteredTables, error } = await supabaseClient.rpc('get_tables_for_day', {
            day_string: dateString
        });

        if (error) {
            console.error('Error fetching tables:', error);
            loadingSpinner.classList.add('hidden');
            tablesContainer.innerHTML = `<div class="text-center p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
                <p class="font-bold">Could not load tables.</p>
                <p class="text-sm mt-1"><strong>Error:</strong> ${error.message}</p>
                <p class="text-xs mt-2">Please check your Supabase URL, anon key, and that you have enabled Row Level Security (RLS) with a read policy on the 'tables' table.</p>
            </div>`;
            return;
        }
        
        loadingSpinner.classList.add('hidden');

        if (!filteredTables || filteredTables.length === 0) {
            noTablesMessage.classList.remove('hidden');
            return;
        }

        filteredTables.forEach(table => {
            const card = document.createElement('div');
            card.className = `bg-white rounded-xl shadow-md overflow-hidden transform hover:-translate-y-1 transition-transform duration-300 ${currentUserState.joinedTableId === table.id ? 'ring-2 ring-brand-accent' : ''} ${table.is_cancelled ? 'opacity-60' : ''}`;

            const spotsLeft = table.total_spots - table.spots_filled;
            const isFull = spotsLeft <= 0;
            const isUserJoined = currentUserState.isLoggedIn && currentUserState.joinedTableId === table.id;
            const isUserWaitlisted = currentUserState.isLoggedIn && currentUserState.waitlistedTableIds.includes(table.id);

            let button;
            if (table.is_cancelled) {
                button = createButton('Cancelled', ['btn-disabled'], true);
            } else if (isUserJoined) {
                if (table.is_locked) {
                    button = createButton('Locked In', ['btn-disabled'], true);
                } else {
                    button = createButton('Leave Table', ['leave-button', 'btn-secondary']);
                    button.dataset.tableId = table.id;
                }
            } else {
                if (isFull) {
                    if (isUserWaitlisted) {
                        button = createButton('Leave Waitlist', ['leave-waitlist-button', 'btn-secondary']);
                        button.dataset.tableId = table.id;
                    } else if (!currentUserState.isLoggedIn) {
                        button = createButton('log in to join waitlist', ['join-waitlist-button', 'btn-primary']);
                        button.dataset.tableId = table.id;
                    } else {
                        button = createButton('Join Waitlist', ['join-waitlist-button', 'btn-primary']);
                        button.dataset.tableId = table.id;
                    }
                } else {
                    if (currentUserState.joinedTableId) {
                         button = createButton('In Another Table', ['btn-disabled'], true);
                    } else if (!currentUserState.isLoggedIn) {
                         button = createButton('log in to join table', ['join-button', 'btn-primary']);
                         button.dataset.tableId = table.id;
                    } else {
                         button = createButton('Join Table', ['join-button', 'btn-primary']);
                         button.dataset.tableId = table.id;
                    }
                }
            }
            
            let bannerHTML = '';
            if (table.is_cancelled) {
                bannerHTML = '<div class="cancelled-banner text-center p-2 text-sm font-semibold font-sans">This dinner has been cancelled.</div>';
            } else if (table.is_locked && isUserJoined) {
                bannerHTML = '<div class="locked-in-banner text-center p-2 text-sm font-semibold font-sans">You are locked in for this dinner!</div>';
            }
            
            let themeHTML = '';
            if(table.theme) {
                themeHTML = `<span class="inline-block bg-indigo-100 text-indigo-800 text-xs font-medium px-2.5 py-0.5 rounded-full">${table.theme}</span>`;
            }

            // FIX: Robust dot rendering that tolerates null/undefined and keeps relationships sane
            const totalRaw  = Number(table.total_spots);
            const filledRaw = Number(table.spots_filled);
            const minRaw    = Number(table.min_spots);

            const filled = Number.isFinite(filledRaw) ? Math.max(0, filledRaw) : 0;

            // Prefer explicit total; else fall back to min; else to filled; else 0
            let total = Number.isFinite(totalRaw) ? totalRaw
                       : Number.isFinite(minRaw)  ? minRaw
                       : (filled > 0 ? filled : 0);

            // Derive a sane min
            let min = Number.isFinite(minRaw) ? minRaw : Math.max(0, Math.min(total, filled));

            // Clamp relationships
            total = Math.max(total, min, filled);
            min   = Math.min(min, total);

            // Build dots
            let dots = [];
            for (let i = 0; i < total; i++) {
                if (i < filled) {
                    dots.push(`<span class="inline-block h-2.5 w-2.5 rounded-full bg-brand-accent"></span>`);     // filled
                } else if (i < min) {
                    dots.push(`<span class="inline-block h-2.5 w-2.5 rounded-full bg-brand-gray-dark"></span>`);  // minimum
                } else {
                    dots.push(`<span class="inline-block h-2.5 w-2.5 rounded-full bg-gray-300"></span>`);         // extra capacity
                }
            }

            const spotsIndicatorHTML = dots.join('');

            // Safe displays
            const totalDisplay  = Number.isFinite(totalRaw)  ? totalRaw  : total;
            const filledDisplay = Number.isFinite(filledRaw) ? filledRaw : filled;

            console.log({
              tableId: table.id,
              total,
              filled,
              min,
              dotsLength: dots.length
            });
const cardContent = document.createElement('div');
            cardContent.innerHTML = `
                ${bannerHTML}
                <div class="p-6">
                    <div class="flex flex-col sm:flex-row justify-between sm:items-center">
                        <div>
                            <div class="flex items-center space-x-3">
                                <div class="text-lg font-bold text-brand-accent font-heading">${table.time}</div>
                                <div class="text-gray-400">&bull;</div>
                                <div class="text-lg font-semibold text-brand-text font-heading">${table.neighborhood}</div>
                            </div>
                             <div class="flex items-center space-x-2 mt-1">
                                <p class="text-sm text-gray-500 font-sans">Age Range: ${table.age_range}</p>
                                ${themeHTML ? `<div class="text-gray-400">&bull;</div> ${themeHTML}` : ''}
                            </div>
                        </div>
                        <div class="mt-4 sm:mt-0 flex-shrink-0" id="button-container-${table.id}">
                        </div>
                    </div>
                    <div class="mt-4 pt-4 border-t border-gray-200">
                        <div class="flex items-center justify-between text-sm">
                            <p class="text-gray-600 font-heading">Spots Filled:</p>
                            <div class="flex items-center flex-wrap gap-1">
                                ${spotsIndicatorHTML}
                                <span class="font-medium text-brand-text">${filledDisplay}/${totalDisplay}</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            card.appendChild(cardContent);
            card.querySelector(`#button-container-${table.id}`).appendChild(button);
            tablesContainer.appendChild(card);
        });
        
        document.querySelectorAll('.join-button').forEach(button => button.addEventListener('click', handleJoinClick));
        document.querySelectorAll('.leave-button').forEach(button => button.addEventListener('click', handleLeaveClick));
        document.querySelectorAll('.join-waitlist-button').forEach(button => button.addEventListener('click', handleJoinWaitlistClick));
        document.querySelectorAll('.leave-waitlist-button').forEach(button => button.addEventListener('click', handleLeaveWaitlistClick));
    };

    function createButton(text, classes = [], disabled = false) {
        const button = document.createElement('button');
        button.textContent = text;
        const baseClasses = ['supdinner-button'];
        button.classList.add(...baseClasses, ...classes);
        if (disabled) {
            button.disabled = true;
        }
        return button;
    }
    
    const renderTabs = (dates) => {
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        
        dayTabsContainer.innerHTML = '';
        let tabsHtml = '';
        let previousDayIndex = -1;

        dates.forEach((dateString, index) => {
            const date = new Date(dateString + 'T00:00:00'); 
            const currentDayIndex = date.getDay();
            
            if (index > 0 && currentDayIndex < previousDayIndex) {
                tabsHtml += `<div class="week-separator"></div>`;
            }
            
            const dayName = dayNames[currentDayIndex];
            const monthName = monthNames[date.getMonth()];
            const dayOfMonth = date.getDate();

            const isActive = index === 0;
            if (isActive) activeDate = dateString;
            
            tabsHtml += `
                <a href="#" data-date="${dateString}" class="day-tab whitespace-nowrap text-center py-3 px-1 ${isActive ? 'border-b-2 border-brand-accent text-brand-accent' : 'border-b-2 border-transparent text-gray-500 hover:text-brand-accent hover:border-brand-accent/50'}">
                    <div class="font-heading">${dayName}</div>
                    <div class="font-heading text-xs">${monthName} ${dayOfMonth}</div>
                </a>
            `;
            previousDayIndex = currentDayIndex;
        });

        dayTabsContainer.innerHTML = tabsHtml;
        document.querySelectorAll('.day-tab').forEach(tab => tab.addEventListener('click', handleTabClick));
    };

    // --- EVENT HANDLERS ---
    
    const handleTabClick = (e) => {
        e.preventDefault();
        const tabElement = e.target.closest('.day-tab');
        if (!tabElement) return;
        activeDate = tabElement.dataset.date;
        document.querySelectorAll('.day-tab').forEach(tab => {
            tab.classList.toggle('border-brand-accent', tab.dataset.date === activeDate);
            tab.classList.toggle('text-brand-accent', tab.dataset.date === activeDate);
            tab.classList.toggle('border-transparent', tab.dataset.date !== activeDate);
            tab.classList.toggle('text-gray-500', tab.dataset.date !== activeDate);
        });
        renderTables(activeDate);
    };

    const handleJoinClick = async (e) => {
        selectedTableId = parseInt(e.target.dataset.tableId);
        
        if (!currentUserState.isLoggedIn) {
            // User not logged in, open auth modal
            openModal(authModal);
            showAuthStep('signup');
            return;
        }
        
        const { data: table } = await supabaseClient.from('tables').select('time, neighborhood').eq('id', selectedTableId).single();
        if (table) {
            modalTableDetails.innerHTML = `You're joining the <strong>${table.time}</strong> dinner in <strong>${table.neighborhood}</strong>.`;
        }
        joinModalTitle.textContent = "Join the Table";
        openModal(joinModal);
    };

    const handleLeaveClick = async (e) => {
        const tableId = parseInt(e.target.dataset.tableId);
        try {
            const { error } = await supabaseClient.functions.invoke('leave-table', {
                body: { tableId, userId: currentUserState.userId }
            });
            if (error) throw error;
            await refreshData();
        } catch (error) {
            alert(`Error leaving table: ${error.message}`);
        }
    };
    
    const handleJoinWaitlistClick = async (e) => {
        selectedTableId = parseInt(e.target.dataset.tableId);

        if (!currentUserState.isLoggedIn) {
            // User not logged in, open auth modal
            openModal(authModal);
            showAuthStep('signup');
            return;
        }
        
        try {
            const { error } = await supabaseClient.functions.invoke('join-waitlist', {
                body: { tableId: selectedTableId, userId: currentUserState.userId }
            });
            if (error) throw error;
            await refreshData();
        } catch (error) {
            alert(`Error joining waitlist: ${error.message}`);
        }
    };

    const handleLeaveWaitlistClick = async (e) => {
        const tableId = parseInt(e.target.dataset.tableId);
        try {
            const { error } = await supabaseClient.functions.invoke('leave-waitlist', {
                body: { tableId, userId: currentUserState.userId }
            });
            if (error) throw error;
            await refreshData();
        } catch (error) {
            alert(`Error leaving waitlist: ${error.message}`);
        }
    };

    userInfoForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        formError1.classList.add('hidden');
        joinSubmitButton.disabled = true;

        // Validate all required fields
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const phoneNumber = document.getElementById('phone-number').value;
        const firstName = document.getElementById('first-name').value;
        const ageRange = document.getElementById('age-range').value;
        const referralSource = document.getElementById('referral-source').value;
        const disclaimerChecked = document.getElementById('disclaimer-checkbox').checked;
        const marketingOptIn = document.getElementById('marketing-checkbox').checked;

        if (!email || !password || !phoneNumber || !firstName || !ageRange || !disclaimerChecked) {
            formError1.textContent = "Please fill out all required fields and agree to the terms.";
            formError1.classList.remove('hidden');
            joinSubmitButton.disabled = false;
            return;
        }

        try {
            const formData = {
                email: email,
                password: password,
                phoneNumber: phoneNumber,
                firstName: firstName,
                ageRange: ageRange,
                referralSource: referralSource,
                marketingOptIn: marketingOptIn,
                tableId: selectedTableId
            };

            const { data, error } = await supabaseClient.functions.invoke('auth-signup', { body: formData });
            if (error) throw error;
            
            // Store both user IDs
            localStorage.setItem('supdinner_user_id', data.userId);
            localStorage.setItem('supdinner_auth_user_id', data.authUserId);
            
            showSuccessStep();
        } catch(error) {
            formError1.textContent = `Error: ${error.message}`;
            formError1.classList.remove('hidden');
            joinSubmitButton.disabled = false;
        }
    });

    logoutLink.addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('supdinner_user_id');
        refreshData();
    });
    
    requestTableBtn.addEventListener('click', () => {
        openModal(requestModal);
    });

    loginButton.addEventListener('click', () => {
        openModal(authModal);
        showAuthStep('login');
    });

    // Auth login form handler
    authLoginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        authLoginError.classList.add('hidden');
        const email = document.getElementById('auth-login-email').value;
        const password = document.getElementById('auth-login-password').value;

        if (!email || !password) {
            authLoginError.textContent = "Please enter your email and password.";
            authLoginError.classList.remove('hidden');
            return;
        }

        try {
            // First, try to sign in with Supabase Auth
            const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
                email,
                password
            });
            
            if (authError) throw authError;
            
            // Check if user profile exists in our database
            let profileData = null;
            try {
                const { data: profileResponse, error: profileError } = await supabaseClient.functions.invoke('get-user-by-auth-id', {
                    body: { authUserId: authData.user.id }
                });
                
                if (profileError) throw profileError;
                
                // Log the response to debug
                console.log('Profile response:', profileResponse);
                
                if (profileResponse && profileResponse.success && profileResponse.user) {
                    profileData = profileResponse.user; // Extract the user object
                } else {
                    console.log('Profile not found or invalid response');
                }
            } catch (profileError) {
                // Profile doesn't exist, we need to create it
                console.log('Profile not found, will create new profile:', profileError);
            }
            
            if (!profileData) {
                // Create the user profile using stored data or default values
                const storedProfileData = localStorage.getItem('supdinner_profile_data');
                let profileToCreate;
                
                if (storedProfileData) {
                    // Use stored profile data from signup
                    profileToCreate = JSON.parse(storedProfileData);
                    localStorage.removeItem('supdinner_profile_data'); // Clean up
                } else {
                    // Create minimal profile (this shouldn't happen in normal flow)
                    profileToCreate = {
                        phoneNumber: '',
                        firstName: '',
                        ageRange: '',
                        referralSource: '',
                        marketingOptIn: false,
                        tableId: selectedTableId
                    };
                }
                
                // Create the profile
                const { data: createProfileData, error: createProfileError } = await supabaseClient.functions.invoke('create-user-profile', {
                    body: profileToCreate
                });
                
                if (createProfileError) throw createProfileError;
                
                // Log the created profile data to debug
                console.log('Created profile data:', createProfileData);
                
                profileData = createProfileData;
            }
            
            // Log the final profile data before validation
            console.log('Final profile data before validation:', profileData);
            
            // Validate profile data before proceeding
            // Note: Database returns 'id' and 'auth_user_id', not 'userId' and 'authUserId'
            if (!profileData.id || !profileData.auth_user_id) {
                console.error('Profile data validation failed:', {
                    hasId: !!profileData.id,
                    hasAuthUserId: !!profileData.auth_user_id,
                    profileData: profileData
                });
                throw new Error('Invalid profile data received. Please try again.');
            }
            
            // Store user IDs in localStorage
            localStorage.setItem('supdinner_user_id', profileData.id);
            localStorage.setItem('supdinner_auth_user_id', profileData.auth_user_id);
            
            console.log('Stored user IDs:', {
                userId: profileData.id,
                authUserId: profileData.auth_user_id
            });
            
            // Update user state
            currentUserState = {
                isLoggedIn: true,
                userId: profileData.id,
                joinedTableId: profileData.joinedTableId || null,
                waitlistedTableIds: profileData.waitlistedTableIds || [],
                isSuspended: profileData.is_suspended || false,
                suspensionEndDate: profileData.suspension_end_date || null,
                name: profileData.first_name,
                phone: profileData.phone_number
            };
            
            closeModal(authModal);
            
            // Small delay to ensure localStorage is set before refreshData
            setTimeout(async () => {
                await refreshData();
            }, 100);
            
            // If user was trying to join a table, do it now
            if (selectedTableId) {
                await joinTableAfterLogin(selectedTableId);
            }
        } catch(error) {
            console.error('Login error:', error);
            authLoginError.textContent = `Error: ${error.message}`;
            authLoginError.classList.remove('hidden');
        }
    });
    
    // Auth signup form handler
    authSignupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        authSignupError.classList.add('hidden');
        authSignupSubmit.disabled = true;

        // Validate all required fields
        const email = document.getElementById('auth-signup-email').value;
        const password = document.getElementById('auth-signup-password').value;
        const phoneNumber = document.getElementById('auth-signup-phone').value;
        const firstName = document.getElementById('auth-signup-firstname').value;
        const ageRange = document.getElementById('auth-signup-age').value;
        const referralSource = document.getElementById('auth-signup-referral').value;
        const disclaimerChecked = document.getElementById('auth-signup-disclaimer').checked;
        const marketingOptIn = document.getElementById('auth-signup-marketing').checked;

        if (!email || !password || !phoneNumber || !firstName || !ageRange || !disclaimerChecked) {
            authSignupError.textContent = "Please fill out all required fields and agree to the terms.";
            authSignupError.classList.remove('hidden');
            authSignupSubmit.disabled = false;
            return;
        }

        try {
            // First, create the Supabase Auth user (this automatically sends verification email)
            const { data: authData, error: authError } = await supabaseClient.auth.signUp({
                email: email,
                password: password,
                options: {
                    emailRedirectTo: `${window.location.origin}/auth/callback`,
                    data: {
                        phone_number: phoneNumber,
                        first_name: firstName
                    }
                }
            });

            if (authError) throw authError;

            // Check if the signup was successful even if email failed
            if (authData.user) {
                // Store the auth user ID temporarily
                localStorage.setItem('supdinner_temp_auth_user_id', authData.user.id);
                localStorage.setItem('supdinner_signup_email', email);
                
                // Store the profile data for later creation
                localStorage.setItem('supdinner_profile_data', JSON.stringify({
                    phoneNumber,
                    firstName,
                    ageRange,
                    referralSource,
                    marketingOptIn,
                    tableId: selectedTableId
                }));
                
                // Clear any existing user state
                localStorage.removeItem('supdinner_user_id');
                localStorage.removeItem('supdinner_auth_user_id');
                
                // Reset user state
                currentUserState = { 
                    isLoggedIn: false, 
                    userId: null, 
                    joinedTableId: null, 
                    waitlistedTableIds: [], 
                    isSuspended: false, 
                    suspensionEndDate: null 
                };
                
                // Show email verification modal
                closeModal(authModal);
                openModal(emailVerificationModal);
            } else {
                throw new Error("Failed to create account. Please try again.");
            }
            
        } catch(error) {
            authSignupError.textContent = `Error: ${error.message}`;
            authSignupError.classList.remove('hidden');
            authSignupSubmit.disabled = false;
        }
    });

    requestInfoForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        requestFormError.classList.add('hidden');
        const formData = {
            name: document.getElementById('request-name').value,
            phone: document.getElementById('request-phone').value,
            day: document.getElementById('request-day').value,
            time: document.getElementById('request-time').value,
            neighborhood: document.getElementById('request-neighborhood').value,
            ageRange: document.getElementById('request-age-range').value,
            theme: document.getElementById('request-theme').value,
        };
        
        try {
            const { error } = await supabaseClient.functions.invoke('send-request-notification', { body: formData });
            if (error) throw error;
            showModalStep(2, requestModal);
        } catch(error) {
            requestFormError.textContent = `Error: ${error.message}`;
            requestFormError.classList.remove('hidden');
        }
    });

    disclaimerCheckbox.addEventListener('change', () => {
        // Always require disclaimer checkbox to be checked
        joinSubmitButton.disabled = !disclaimerCheckbox.checked;
    });
    
    // Auth signup disclaimer checkbox handler
    document.getElementById('auth-signup-disclaimer').addEventListener('change', () => {
        authSignupSubmit.disabled = !document.getElementById('auth-signup-disclaimer').checked;
    });

    requestDisclaimerCheckbox.addEventListener('change', () => {
        requestSubmitButton.disabled = !requestDisclaimerCheckbox.checked;
    });


    // --- MODAL CONTROLS ---
    
    function openModal(modal) {
        modal.classList.remove('hidden');
        setTimeout(() => {
            modal.classList.remove('opacity-0');
            modal.querySelector('.modal-content').classList.remove('scale-95');
        }, 10);
    }

    function closeModal(modal) {
        modal.classList.add('opacity-0');
        modal.querySelector('.modal-content').classList.add('scale-95');
        setTimeout(() => {
            modal.classList.add('hidden');
            const form = modal.querySelector('form');
            if (form) form.reset();
            if (modal === joinModal) {
                 showModalStep(1, joinModal);
                 formError1.classList.add('hidden');
                 joinSubmitButton.disabled = false;
            }
            if (modal === requestModal) {
                showModalStep(1, requestModal);
                requestFormError.classList.add('hidden');
                requestSubmitButton.disabled = true;
            }
            if (modal === loginModal) {
                loginFormError.classList.add('hidden');
            }
            refreshData();
        }, 300);
    }

    function showModalStep(step, modal) {
        const steps = modal.querySelectorAll('[id^="modal-step-"], [id^="request-step-"]');
        steps.forEach(stepEl => {
            const stepNumber = stepEl.id.split('-').pop();
            stepEl.classList.toggle('hidden', stepNumber != step);
        });
    }
    
    function showAuthStep(step) {
        if (step === 'login') {
            authLoginStep.classList.remove('hidden');
            authSignupStep.classList.add('hidden');
        } else {
            authLoginStep.classList.add('hidden');
            authSignupStep.classList.remove('hidden');
        }
    }
    
    function showSuccessStep() {
        successTitle.textContent = "You're In!";
        successMessage.textContent = "Welcome to the table! We'll send the final details to your phone soon. See you there!";
        showModalStep(3, joinModal);
    }

    closeButton1.addEventListener('click', () => closeModal(joinModal));
    closeButton3.addEventListener('click', () => closeModal(joinModal));
    joinModal.addEventListener('click', (e) => { if (e.target === joinModal) closeModal(joinModal); });

    // Auth modal event listeners
    closeAuthModal.addEventListener('click', () => closeModal(authModal));
    authModal.addEventListener('click', (e) => { if (e.target === authModal) closeModal(authModal); });
    switchToSignup.addEventListener('click', () => showAuthStep('signup'));
    switchToLogin.addEventListener('click', () => showAuthStep('login'));
    
    // Email verification modal
    closeEmailVerification.addEventListener('click', () => closeModal(emailVerificationModal));
    emailVerificationModal.addEventListener('click', (e) => { if (e.target === emailVerificationModal) closeModal(emailVerificationModal); });
    
    // Proceed without email verification (for testing)
    document.getElementById('proceed-without-verification').addEventListener('click', async () => {
        try {
            const profileData = JSON.parse(localStorage.getItem('supdinner_profile_data'));
            const tempAuthUserId = localStorage.getItem('supdinner_temp_auth_user_id');
            
            if (!profileData || !tempAuthUserId) {
                alert('Profile data not found. Please try signing up again.');
                return;
            }
            
            // Create the user profile using the create-user-profile function
            const { data, error } = await supabaseClient.functions.invoke('create-user-profile', { 
                body: profileData 
            });
            
            if (error) throw error;
            
            // Store the user IDs
            localStorage.setItem('supdinner_user_id', data.userId);
            localStorage.setItem('supdinner_auth_user_id', data.authUserId);
            
            // Clear temporary data
            localStorage.removeItem('supdinner_temp_auth_user_id');
            localStorage.removeItem('supdinner_profile_data');
            
            // Close modal and refresh
            closeModal(emailVerificationModal);
            await refreshData();
            
            // Show success message
            alert('Account created successfully! You can now log in.');
            
        } catch (error) {
            alert(`Error creating profile: ${error.message}`);
        }
    });
    
    // Resend verification email
    resendVerification.addEventListener('click', async () => {
        const email = localStorage.getItem('supdinner_signup_email');
        if (!email) {
            resendStatus.textContent = "Error: No email found. Please try signing up again.";
            resendStatus.classList.remove('hidden');
            return;
        }
        
        try {
            resendVerification.disabled = true;
            resendVerification.textContent = "Sending...";
            
            const { data, error } = await supabaseClient.functions.invoke('resend-verification', { 
                body: { email: email } 
            });
            
            if (error) throw error;
            
            resendStatus.textContent = "Verification email sent! Please check your inbox and spam folder.";
            resendStatus.classList.remove('hidden');
            resendStatus.className = 'mt-4 text-sm text-green-600';
            
        } catch (error) {
            resendStatus.textContent = `Error: ${error.message}`;
            resendStatus.classList.remove('hidden');
            resendStatus.className = 'mt-4 text-sm text-red-600';
        } finally {
            resendVerification.disabled = false;
            resendVerification.textContent = "Resend Verification Email";
        }
    });

    closeRequestModal1.addEventListener('click', () => closeModal(requestModal));
    closeRequestModal2.addEventListener('click', () => closeModal(requestModal));
    requestModal.addEventListener('click', (e) => { if (e.target === requestModal) closeModal(requestModal); });


    // --- HELPER FUNCTIONS ---
    
    async function joinTableAfterLogin(tableId) {
        try {
            const { error } = await supabaseClient.functions.invoke('join-table', {
                body: {
                    tableId: tableId,
                    userId: currentUserState.userId
                }
            });
            
            if (error) throw error;
            
            // Update user state
            currentUserState.joinedTableId = tableId;
            
            // Refresh the display
            await refreshData();
            
            // Show success message
            alert('Successfully joined the table!');
            
        } catch (error) {
            alert(`Error joining table: ${error.message}`);
        }
    }
    
    // --- INITIALIZATION & REFRESH LOGIC ---

    async function refreshData() {
        const localUserId = localStorage.getItem('supdinner_user_id');
        const localAuthUserId = localStorage.getItem('supdinner_auth_user_id');

        console.log('refreshData - localStorage values:', { localUserId, localAuthUserId });

        if (localUserId && localAuthUserId && localUserId !== 'undefined' && localAuthUserId !== 'undefined') {
            try {
                loginButton.classList.add('hidden');
                
                // Validate UUID format before querying
                if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(localUserId)) {
                    throw new Error('Invalid user ID format');
                }
                
                const { data: profile, error: profileError } = await supabaseClient.from('users').select('first_name, is_suspended, suspension_end_date, phone_number').eq('id', localUserId).single();
                if (profileError) throw profileError;
                
                const { data: signup, error: signupError } = await supabaseClient.from('signups').select('table_id').eq('user_id', localUserId).maybeSingle();
                if (signupError) throw signupError;
                
                const { data: waitlists, error: waitlistsError } = await supabaseClient.from('waitlists').select('table_id').eq('user_id', localUserId);
                if (waitlistsError) throw waitlistsError;

                if (profile) {
                    currentUserState = {
                        isLoggedIn: true,
                        userId: localUserId,
                        joinedTableId: signup ? signup.table_id : null,
                        waitlistedTableIds: waitlists ? waitlists.map(w => w.table_id) : [],
                        isSuspended: profile.is_suspended,
                        suspensionEndDate: profile.suspension_end_date,
                        name: profile.first_name,
                        phone: profile.phone_number
                    };
                    userGreetingSpan.textContent = `Welcome, ${profile.first_name}!`;
                    userStatusDiv.classList.remove('hidden');
                    document.getElementById('request-name').value = profile.first_name;
                    document.getElementById('request-phone').value = profile.phone_number;
                } else {
                    // Clear invalid user state
                    localStorage.removeItem('supdinner_user_id');
                    localStorage.removeItem('supdinner_auth_user_id');
                    currentUserState = { isLoggedIn: false, userId: null, joinedTableId: null, waitlistedTableIds: [], isSuspended: false, suspensionEndDate: null };
                    userStatusDiv.classList.add('hidden');
                    loginButton.classList.remove('hidden');
                }
            } catch (error) {
                console.error('Error in refreshData:', error);
                // Clear invalid user state on error
                localStorage.removeItem('supdinner_user_id');
                localStorage.removeItem('supdinner_auth_user_id');
                currentUserState = { isLoggedIn: false, userId: null, joinedTableId: null, waitlistedTableIds: [], isSuspended: false, suspensionEndDate: null };
                userStatusDiv.classList.add('hidden');
                loginButton.classList.remove('hidden');
            }
        } else {
            // Clear any partial user state
            localStorage.removeItem('supdinner_user_id');
            localStorage.removeItem('supdinner_auth_user_id');
            loginButton.classList.remove('hidden');
            currentUserState = { isLoggedIn: false, userId: null, joinedTableId: null, waitlistedTableIds: [], isSuspended: false, suspensionEndDate: null };
            userStatusDiv.classList.add('hidden');
        }
        
        if (activeDate) {
            await renderTables(activeDate);
        }
    };

    const initialize = async () => {
        try {
            const { data: dates, error: datesError } = await supabaseClient.rpc('get_distinct_upcoming_dates');
            if (datesError) throw datesError;

            if (dates && dates.length > 0) {
                renderTabs(dates); 
                await refreshData();
            } else {
                loadingSpinner.classList.add('hidden');
                noTablesMessage.textContent = "No upcoming dinners are scheduled. Check back soon!";
                noTablesMessage.classList.remove('hidden');
            }
        } catch (error) {
            console.error("Initialization failed:", error);
            loadingSpinner.classList.add('hidden');
            tablesContainer.innerHTML = `<p class="text-center text-red-500">Could not initialize the application. Please try refreshing the page.</p>`;
        }
    };

    initialize();
});
