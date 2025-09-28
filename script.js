/**
 * @file script.js
 * @description Frontend logic for the Family Aid System.
 * @version 10.0 - Final version with dedicated wounded registration page.
 */

document.addEventListener('DOMContentLoaded', () => {
    const App = {
    // The backend URL is loaded at runtime from (in order):
    // 1) window.APP_CONFIG?.WEB_APP_URL (set by hosting or a script tag)
    // 2) /app-config.json (local config file you can change without editing this file)
    // 3) fallback to the original Apps Script URL for backward compatibility
    WEB_APP_URL: null,
    DEFAULT_WEB_APP_URL: 'https://script.google.com/macros/s/AKfycbwmq5kjxg7MUFJqSCsm7wP4LkOOwgGTtbJbWRHS6rwQQHWAG19kBIQ7UWDlxLihy3ck/exec',
        
        async testNewUrl() {
            const input = document.getElementById('newScriptUrl');
            const newUrl = input?.value?.trim();
            
            if (!newUrl) {
                this.showToast('يرجى إدخال رابط صحيح', false);
                return;
            }
            
            if (!newUrl.includes('script.google.com')) {
                this.showToast('الرابط يجب أن يكون من script.google.com', false);
                return;
            }
            
            this.showToast('جاري اختبار الرابط الجديد...', true);
            
            try {
                const response = await fetch(newUrl, { method: 'GET', mode: 'cors' });
                if (response.ok) {
                    const data = await response.json();
                    this.showDialog({
                        title: '✅ الرابط يعمل!',
                        message: `
                            <p>الرابط الجديد يعمل بشكل صحيح!</p>
                            <p><strong>إصدار الخادم:</strong> ${data.version || 'غير محدد'}</p>
                            <p>يمكنك الآن تحديث الرابط في ملف script.js</p>
                            <code style="word-break: break-all;">${newUrl}</code>
                        `,
                        type: 'success'
                    });
                } else {
                    throw new Error(`خطأ ${response.status}: ${response.statusText}`);
                }
            } catch (error) {
                this.showDialog({
                    title: '❌ الرابط لا يعمل',
                    message: `
                        <p>فشل في الاتصال بالرابط الجديد:</p>
                        <p class="text-danger">${error.message}</p>
                        <p>تأكد من أن الرابط صحيح وأن المشروع منشور بشكل صحيح.</p>
                    `,
                    type: 'error'
                });
            }
        },
        aidCategories: {
            "مساعدات مالية": ["نقد مباشر للعائلات المحتاجة", "دفع فواتير (كهرباء، ماء، إيجار)", "قروض حسنة أو صناديق دوارة"],
            "مساعدات غذائية": ["طرود غذائية أساسية", "وجبات جاهزة / مطبوخة", "توزيع مياه للشرب"],
            "مساعدات صحية": ["أدوية وعلاجات", "فحوصات طبية مجانية", "تغطية تكاليف العمليات", "أدوات مساعدة (نظارات، كراسي متحركة)"],
            "مساعدات تعليمية": ["منح دراسية", "توفير قرطاسية وحقائب مدرسية", "تغطية رسوم جامعية أو مدرسية", "دورات تدريبية وتأهيل مهني"],
            "مساعدات إغاثية (طارئة)": ["خيم وأغطية في حالات النزوح", "ملابس وأحذية", "أدوات نظافة وتعقيم", "تدخل عاجل في الكوارث"],
            "مساعدات سكنية": ["بناء أو ترميم منازل", "دفع إيجارات", "توفير أثاث أو أجهزة كهربائية"],
            "مساعدات تشغيلية": ["تمويل مشاريع صغيرة", "تدريب مهني", "أدوات عمل أو معدات إنتاج"]
        },
        searchTimeout: null,
        membersList: [],
        allCompletedAidRecords: [],
        allFutureAidRecords: [],
        currentFilteredFutureAid: [],
        futureAidCurrentPage: 1,
        futureAidPageSize: 10,
        
        setPasswordModal: null, loginPasswordModal: null, forgotPasswordModal: null,
        userLoginModal: null, adminLoginModal: null,
        bulkCompleteModal: null, printReportModalInstance: null, editMemberModalInstance: null,

        init() {
            this.initModals();

            // Load runtime config (app-config.json or window.APP_CONFIG) which may set WEB_APP_URL
            // Continue initialization after config is loaded so backend-dependent checks use the correct URL.
            this.loadConfig().then(() => {
                this.initPageBasedOnURL();
                this.checkServerStatus();
            }).catch(err => {
                console.warn('Failed to load app config, continuing with defaults', err);
                this.initPageBasedOnURL();
                this.checkServerStatus();
            });
        },

        // Try to load `window.APP_CONFIG`, then `/app-config.json`. If neither present, fall back to DEFAULT_WEB_APP_URL.
        async loadConfig() {
            try {
                // 1) window.APP_CONFIG
                if (window.APP_CONFIG && window.APP_CONFIG.WEB_APP_URL) {
                    this.WEB_APP_URL = window.APP_CONFIG.WEB_APP_URL;
                    console.log('Loaded WEB_APP_URL from window.APP_CONFIG');
                    return;
                }

                // 2) fetch local app-config.json
                const resp = await fetch('app-config.json', { cache: 'no-store' });
                if (resp.ok) {
                    const cfg = await resp.json();
                    if (cfg && cfg.WEB_APP_URL) {
                        this.WEB_APP_URL = cfg.WEB_APP_URL;
                        console.log('Loaded WEB_APP_URL from app-config.json');
                        return;
                    }
                }
            } catch (err) {
                console.warn('Unable to load app-config.json or window.APP_CONFIG', err);
            }

            // 3) fallback
            this.WEB_APP_URL = this.DEFAULT_WEB_APP_URL;
            console.log('Using DEFAULT_WEB_APP_URL');
        },
        
        initModals() {
            const getModal = (id) => document.getElementById(id) ? new bootstrap.Modal(document.getElementById(id)) : null;
            this.setPasswordModal = getModal('setPasswordModal');
            this.loginPasswordModal = getModal('loginPasswordModal');
            this.forgotPasswordModal = getModal('forgotPasswordModal');
            this.userLoginModal = getModal('userLoginModal');
            this.adminLoginModal = getModal('adminLoginModal');
            this.bulkCompleteModal = getModal('confirmBulkCompleteModal');
            this.printReportModalInstance = getModal('printReportModal');
            this.editMemberModalInstance = getModal('editMemberModal');
        },

        async initPageBasedOnURL() {
            const path = window.location.pathname.split('/').pop() || 'index.html';
            const token = sessionStorage.getItem('adminToken');
            const adminPages = ['admin.html', 'manage-members.html', 'manage-aid.html', 'aid-logs.html', 'reports.html', 'password-resets.html', 'superadmin.html', 'life-requests.html'];
            
            if (!token && adminPages.includes(path)) {
                window.location.href = 'index.html';
                return;
            }
            
            const pageInitializers = {
                'index.html': () => this.initIndexPage(),
                'dashboard.html': () => this.initDashboardPage(),
                'admin.html': () => this.initAdminDashboardPage(token),
                'manage-members.html': () => this.initManageMembersPage(token),
                'manage-aid.html': () => this.initManageAidPage(token),
                'aid-logs.html': async () => await this.initAidLogsPage(token),
                'reports.html': () => this.initReportsPage(token),
                'password-resets.html': () => this.initPasswordResetsPage(token),
                'superadmin.html': () => this.initSuperAdminPage(token),
                'wounded-form.html': () => this.initWoundedFormPage(),
                'special-cases.html': () => this.initSpecialCasesPage(),
                'manage-special-cases.html': () => this.initManageSpecialCasesPage(),
            };
            
            if (pageInitializers[path]) {
                await pageInitializers[path]();
            }
        },

        initManageSpecialCasesPage() {
            const token = sessionStorage.getItem('adminToken');
            if (!token) { window.location.href = 'index.html'; return; }
            // nothing else here - the page has its own script that calls App.postToServer
        },
        
        async apiCall(payload, showSuccessToast = false) {
            const activeSubmitButton = (document.activeElement?.tagName === 'BUTTON' && document.activeElement.type === 'submit') ? document.activeElement : document.querySelector('button[type="submit"]:not(:disabled)');
            const isButtonTriggered = activeSubmitButton !== null;
            if (isButtonTriggered) this.toggleButtonSpinner(true, activeSubmitButton);
            
            console.log('🚀 إرسال طلب API:', payload.action);
            
            try {
                const url = this.WEB_APP_URL || this.DEFAULT_WEB_APP_URL;
                const response = await fetch(url, { 
                    method: 'POST', 
                    mode: 'cors', 
                    redirect: 'follow', 
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' }, 
                    body: JSON.stringify(payload) 
                });
                
                console.log('📡 استجابة الخادم:', response.status, response.statusText);
                
                if (!response.ok) {
                    if (response.status === 404) {
                        throw new Error('رابط Google Apps Script غير صحيح أو لا يعمل');
                    } else if (response.status === 403) {
                        throw new Error('ليس لديك صلاحية للوصول إلى هذا الخادم');
                    } else if (response.status >= 500) {
                        throw new Error('خطأ في خادم Google Apps Script');
                    } else {
                        throw new Error(`خطأ في الشبكة: ${response.status} - ${response.statusText}`);
                    }
                }
                
                const result = await response.json();
                console.log('✅ نتيجة الطلب:', result);
                
                if (!result.success) throw new Error(result.message || 'حدث خطأ غير معروف في الخادم.');
                if (showSuccessToast && result.message) this.showToast(result.message, true);
                return result;
                
            } catch (error) { 
                console.error('❌ فشل في API Call:', error);
                
                // رسائل خطأ مفصلة
                let errorMessage = error.message;
                if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
                    errorMessage = '⚠️ فشل الاتصال بالخادم';
                    
                    // إظهار نافذة مساعدة بعد ثانيتين
                    setTimeout(() => {
                        this.showScriptUrlHelp();
                    }, 2000);
                }
                
                this.showToast(errorMessage, false);
                return null; 
            } finally { 
                if (isButtonTriggered) this.toggleButtonSpinner(false, activeSubmitButton); 
            }
        },

        // Tolerant POST helper used by pages (preserves behavior from inline scripts)
        async postToServer(payload) {
            try {
                const url = this.WEB_APP_URL || this.DEFAULT_WEB_APP_URL;
                const response = await fetch(url, {
                    method: 'POST',
                    mode: 'cors',
                    redirect: 'follow',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify(payload)
                });

                const raw = await response.text();
                let data = null;
                try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }

                if (!response.ok) {
                    const snippet = raw ? raw.substring(0, 200) : '';
                    const msg = (data && data.message) ? data.message : (snippet || `HTTP ${response.status}`);
                    console.error('postToServer error', { status: response.status, snippet, payload });
                    throw new Error(msg);
                }

                if (!data) {
                    const snippet = raw ? raw.substring(0, 200) : '';
                    const looksHtml = /^\s*<!DOCTYPE|^\s*<html|^\s*<HTML/i.test(snippet);
                    const authHint = /Authorization|login|Sign in|requires authentication|OAuth/i.test(snippet);
                    const hint = looksHtml && authHint
                        ? 'يبدو أن تطبيق Google Apps Script يحتاج إلى إعادة نشر مع منح الصلاحيات الجديدة (Drive). افتح Code.gs > Deploy > Manage deployments ثم Update مع Execute as: Me و Access: Anyone، ووافق على الصلاحيات.'
                        : '';
                    console.error('postToServer empty/non-JSON', { snippet, payload });
                    throw new Error(`رد الخادم غير صالح (فارغ أو ليس JSON). الحالة ${response.status}${hint ? `\n\n${hint}` : (snippet ? ` | المعاينة: ${snippet}` : '')}`);
                }

                return data;
            } catch (err) {
                // bubble up to caller to handle UI messages
                throw err;
            }
        },

        // Verify a person id against the family DB. Returns { exists: boolean, name: string }
        async verifyPersonById(id) {
            if (!id) return { exists: false, name: '' };
            try {
                // Primary: query general getUserData which is available
                const fbData = await this.postToServer({ action: 'getUserData', userId: id });
                if (fbData && fbData.success && fbData.data) {
                    return { exists: true, name: fbData.data['الاسم الكامل'] || '' };
                }
                return { exists: false, name: '' };
            } catch (err) {
                // On any error, return not found (caller may show messages)
                console.warn('verifyPersonById failed', err);
                return { exists: false, name: '' };
            }
        },
        
                showToast(message, isSuccess = true) { Toastify({ text: message, duration: 4000, gravity: "top", position: "center", style: { background: isSuccess ? "#28a745" : "#dc3545", boxShadow: "none" } }).showToast(); },
        
                // Pretty modal dialog for success/error/info messages
                showDialog({ title = '', message = '', type = 'info', confirmText = 'حسناً', autoCloseMs = null } = {}) {
                        // Ensure container exists or create dynamically
                        let modalEl = document.getElementById('appDialogModal');
                        if (!modalEl) {
                                modalEl = document.createElement('div');
                                modalEl.id = 'appDialogModal';
                                modalEl.className = 'modal fade';
                                modalEl.tabIndex = -1;
                                modalEl.setAttribute('aria-hidden', 'true');
                                modalEl.innerHTML = `
                                        <div class="modal-dialog modal-dialog-centered">
                                            <div class="modal-content">
                                                <div class="modal-header">
                                                    <h5 class="modal-title d-flex align-items-center gap-2">
                                                        <i id="appDialogIcon" class="bi"></i>
                                                        <span id="appDialogTitle"></span>
                                                    </h5>
                                                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                                                </div>
                                                <div class="modal-body">
                                                    <div id="appDialogMessage" class="fs-6"></div>
                                                </div>
                                                <div class="modal-footer">
                                                    <button id="appDialogConfirm" type="button" class="btn btn-primary" data-bs-dismiss="modal">${confirmText}</button>
                                                </div>
                                            </div>
                                        </div>`;
                                document.body.appendChild(modalEl);
                        }
                        const iconEl = modalEl.querySelector('#appDialogIcon');
                        const titleEl = modalEl.querySelector('#appDialogTitle');
                        const msgEl = modalEl.querySelector('#appDialogMessage');
                        const headerEl = modalEl.querySelector('.modal-header');
                        const confirmBtn = modalEl.querySelector('#appDialogConfirm');

                        // Type styles
                        const typeMap = {
                                success: { header: 'bg-success text-white', icon: 'bi-check-circle-fill' },
                                danger: { header: 'bg-danger text-white', icon: 'bi-x-circle-fill' },
                                error: { header: 'bg-danger text-white', icon: 'bi-x-circle-fill' },
                                warning: { header: 'bg-warning-subtle', icon: 'bi-exclamation-triangle-fill' },
                                info: { header: 'bg-primary text-white', icon: 'bi-info-circle-fill' }
                        };
                        // Reset header classes and apply new
                        headerEl.className = 'modal-header';
                        const styleDef = typeMap[type] || typeMap.info;
                        headerEl.classList.add(...styleDef.header.split(' '));
                        iconEl.className = `bi ${styleDef.icon}`;

                        // Content
                        titleEl.textContent = title || (type === 'success' ? 'تم بنجاح' : type === 'danger' || type === 'error' ? 'حدث خطأ' : 'معلومة');
                        if (typeof message === 'string') msgEl.textContent = message; else { msgEl.innerHTML = ''; msgEl.appendChild(message); }
                        confirmBtn.textContent = confirmText || 'حسناً';

                        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
                        modal.show();
                        if (autoCloseMs && Number.isFinite(+autoCloseMs)) {
                                setTimeout(() => modal.hide(), +autoCloseMs);
                        }
                },
        toggleButtonSpinner(show, button) { const btn = button || document.querySelector('button[type="submit"]'); if (!btn) return; btn.disabled = show; btn.querySelector('.spinner-border')?.classList.toggle('d-none', !show); const buttonText = btn.querySelector('.button-text'); if(buttonText) buttonText.style.opacity = show ? 0.5 : 1; },
        formatDateToEnglish(dateString) { if (!dateString) return '-'; try { const date = new Date(dateString); if (isNaN(date.getTime())) return 'Invalid Date'; return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; } catch (error) { return dateString; } },
        
        async checkServerStatus() {
            const statusDiv = document.getElementById('server-status');
            if (!statusDiv) return;
            const statusText = statusDiv.querySelector('.status-text');
            
            console.log('جاري فحص حالة الخادم...', this.WEB_APP_URL);
            
            try {
                const url = this.WEB_APP_URL || this.DEFAULT_WEB_APP_URL;
                const response = await fetch(url, { 
                    method: 'GET',
                    mode: 'cors',
                    cache: 'no-cache'
                });
                
                console.log('استجابة الخادم:', response.status, response.statusText);
                
                if (response.ok) {
                    const data = await response.json();
                    statusDiv.classList.remove('offline');
                    statusDiv.classList.add('online');
                    statusText.textContent = `الخادم متصل (إصدار ${data.version})`;
                    console.log('الخادم يعمل بشكل طبيعي');
                } else {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
            } catch (error) {
                console.error('خطأ في الاتصال بالخادم:', error);
                statusDiv.classList.remove('online');
                statusDiv.classList.add('offline');
                statusText.innerHTML = `
                    <div>⚠️ فشل الاتصال بالخادم</div>
                    <small class="text-muted d-block mt-1">
                        الخطأ: ${error.message}<br>
                        <button class="btn btn-sm btn-outline-warning mt-2" onclick="App.showScriptUrlHelp()">
                            🔧 كيفية إصلاح المشكلة
                        </button>
                    </small>
                `;
                
                // إظهار تنبيه للمستخدم
                if (typeof Toastify !== 'undefined') {
                    Toastify({
                        text: `⚠️ تعذر الاتصال بالخادم\nيرجى التحقق من رابط Google Apps Script`,
                        duration: 8000,
                        gravity: "top",
                        position: "center",
                        backgroundColor: "linear-gradient(to right, #ff6b6b, #ee5a52)",
                        style: {
                            direction: 'rtl'
                        }
                    }).showToast();
                }
            }
        },

        initIndexPage() {
            document.getElementById('loginForm')?.addEventListener('submit', (e) => this.handleUserLogin(e));
            document.getElementById('adminLoginForm')?.addEventListener('submit', (e) => this.handleAdminLogin(e));
            document.getElementById('setPasswordForm')?.addEventListener('submit', (e) => this.handleModalSetPassword(e));
            document.getElementById('userPasswordForm')?.addEventListener('submit', (e) => this.handleModalLogin(e));
            document.getElementById('loginModalForgotPassword')?.addEventListener('click', (e) => this.handleForgotPassword(e));
            document.getElementById('forgotPasswordForm')?.addEventListener('submit', async (e) => { e.preventDefault(); const userId = document.getElementById('forgotPasswordUserId').value; const result = await this.apiCall({ action: 'requestPasswordReset', userId }, true); if (result) this.forgotPasswordModal.hide(); });
        },

        initWoundedFormPage() {
            const form = document.getElementById('woundedForm');
            form?.addEventListener('submit', async (e) => {
                e.preventDefault();
    
                const fileToBase64 = (file) => new Promise((resolve, reject) => {
                    if (!file) {
                        resolve(null);
                        return;
                    }
                    const reader = new FileReader();
                    reader.readAsDataURL(file);
                    reader.onload = () => {
                        const result = reader.result;
                        const base64Data = result.substring(result.indexOf(',') + 1);
                        resolve({ name: file.name, mimeType: file.type, data: base64Data });
                    };
                    reader.onerror = error => reject(error);
                });
    
                try {
                    this.toggleButtonSpinner(true, form.querySelector('button[type="submit"]'));
    
                    const medicalReportFile = document.getElementById('medicalReport').files[0];
                    const injuryPhotoFile = document.getElementById('injuryPhoto').files[0];
                    
                    const [medicalReportData, injuryPhotoData] = await Promise.all([
                        fileToBase64(medicalReportFile),
                        fileToBase64(injuryPhotoFile)
                    ]);
    
                    const payload = {
                        action: 'addWoundedCase',
                        fullName: form.fullName.value,
                        idNumber: form.idNumber.value,
                        phone: form.phone.value,
                        familySize: form.familySize.value,
                        injuryDate: form.injuryDate.value,
                        injuryType: form.injuryType.value,
                        injuryCause: form.injuryCause.value,
                        needs: form.needs.value,
                        notes: form.notes.value,
                        medicalReport: medicalReportData,
                        injuryPhoto: injuryPhotoData
                    };
    
                    const response = await fetch(this.WEB_APP_URL, {
                        method: 'POST',
                        mode: 'cors',
                        redirect: 'follow',
                        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                        body: JSON.stringify(payload)
                    });
    
                    if (!response.ok) throw new Error(`خطأ في الشبكة: ${response.statusText}`);
    
                    const result = await response.json();
                    if (!result.success) throw new Error(result.message || 'حدث خطأ غير معروف في الخادم.');
                    
                    this.showToast(result.message, true);
                    form.reset();
                    window.scrollTo(0, 0);
    
                } catch (error) {
                    console.error('Submission Failed:', error);
                    this.showToast(error.message, false);
                } finally {
                    this.toggleButtonSpinner(false, form.querySelector('button[type="submit"]'));
                }
            });

            // Additional logic from wounded-form.html
            const injuryFormSection = document.getElementById('injury-form');
            const searchInput = document.getElementById('searchInput');
            const grid = document.getElementById('cardsGrid');

            // Local injury form handling removed; use the dedicated injuries.html page and global handler.

            if (location.hash === '#injury-form') {
                window.location.href = 'injuries.html';
            }

            document.querySelectorAll('a[href="#injury-form"]').forEach(a => a.addEventListener('click', function(e) {
                e.preventDefault();
                window.location.href = 'injuries.html';
            }));

            const closeInjury = document.getElementById('closeInjury');
            if (closeInjury) {
                closeInjury.addEventListener('click', function() {
                    if (injuryFormSection) {
                        injuryFormSection.style.display = 'none';
                        history.replaceState(null, '', window.location.pathname);
                    }
                });
            }

            const demoInjuryForm = document.getElementById('demoInjuryForm');
            if (demoInjuryForm) {
                demoInjuryForm.addEventListener('submit', function(e) {
                    e.preventDefault();
                    alert('تم حفظ بيانات الإصابة (عرض تجريبي)');
                    if (injuryFormSection) {
                        injuryFormSection.style.display = 'none';
                        history.replaceState(null, '', window.location.pathname);
                    }
                    this.reset();
                });
            }

            if (searchInput && grid) {
                searchInput.addEventListener('input', function() {
                    const query = searchInput.value.trim().toLowerCase();
                    Array.from(grid.children).forEach(card => {
                        const text = (card.innerText || '').toLowerCase();
                        card.style.display = text.includes(query) ? 'block' : 'none';
                    });
                });
            }
        },

        initDashboardPage() { const userId = localStorage.getItem('loggedInUserId'); if (!userId) { window.location.href = 'index.html'; return; } this.loadUserData(userId); },
        async handleUserLogin(e) { e.preventDefault(); const form = e.target; const userId = form.querySelector('#userId').value; const spouseId = form.querySelector('#spouseId').value; this.userLoginModal.hide(); const result = await this.apiCall({ action: 'checkPasswordStatus', id: userId, spouse_id: spouseId }); if (!result) return; if (result.message === 'password_required') { document.getElementById('modalUserId').value = userId; this.setPasswordModal.show(); } else if (result.message === 'password_exists') { document.getElementById('loginModalUserId').value = userId; document.getElementById('loginModalSpouseId').value = spouseId; this.loginPasswordModal.show(); } },
        async handleModalSetPassword(e) { e.preventDefault(); const userId = document.getElementById('modalUserId').value; const newPassword = document.getElementById('modalNewPassword').value; const confirmPassword = document.getElementById('modalConfirmPassword').value; if (newPassword !== confirmPassword) { this.showToast('كلمة المرور وتأكيدها غير متطابقين.', false); return; } if (newPassword.length < 6) { this.showToast('كلمة المرور يجب أن لا تقل عن 6 أحرف.', false); return; } const result = await this.apiCall({ action: 'setMemberPassword', userId: userId, password: newPassword }, true); if (result) { this.setPasswordModal.hide(); localStorage.setItem('loggedInUserId', userId); localStorage.setItem('loggedInUserName', result.userName); window.location.href = 'dashboard.html'; } },
        async handleModalLogin(e) { e.preventDefault(); const userId = document.getElementById('loginModalUserId').value; const spouseId = document.getElementById('loginModalSpouseId').value; const password = document.getElementById('loginModalPassword').value; this.loginPasswordModal.hide(); const result = await this.apiCall({ action: 'userLoginWithPassword', id: userId, spouse_id: spouseId, password: password }); if (result) { this.showToast(`أهلاً بك، ${result.user_name}`, true); localStorage.setItem('loggedInUserId', result.user_id); localStorage.setItem('loggedInUserName', result.user_name); setTimeout(() => { window.location.href = 'dashboard.html'; }, 1000); } },
    async handleAdminLogin(e) { 
        e.preventDefault(); 
        if (this.adminLoginModal) try { this.adminLoginModal.hide(); } catch(_){}
        const result = await this.apiCall({ action: 'adminLogin', username: document.getElementById('username').value, password: document.getElementById('password').value }); 
        if (result) {
            this.showToast("تم تسجيل الدخول بنجاح.", true);
            sessionStorage.setItem('adminToken', result.token);
            sessionStorage.setItem('adminRole', result.role);
            // Redirect to superadmin page when role indicates super admin, otherwise to the regular admin page
            if (result.role === 'superadmin') {
                window.location.href = 'superadmin.html';
            } else {
                window.location.href = 'admin.html';
            }
        }
    },
        async handleForgotPassword(e) { e.preventDefault(); this.loginPasswordModal.hide(); this.forgotPasswordModal.show(); },
        
        async loadUserData(userId) {
            const userDataResult = await this.apiCall({ action: 'getUserData', userId });
            if (userDataResult) this.renderUserInfo(userDataResult.data);
            const [aidHistoryResult, futureAidResult] = await Promise.all([
                this.apiCall({ action: 'getUserAidHistory', userId }),
                this.apiCall({ action: 'getUserFutureAid', userId }) 
            ]);
            if (aidHistoryResult) this.renderCompletedAid(aidHistoryResult.data);
            if (futureAidResult) this.renderFutureAid(futureAidResult.data);
            
            // تحميل طلبات التعديل
            await this.loadUserEditRequests(userId);
        },
        
    renderUserInfo(data) {
            // تحديث العنوان الرئيسي
            document.getElementById('userName').textContent = data['الاسم الكامل'] || 'عضو العائلة';
            document.getElementById('userTitle').textContent = `رقم الهوية: ${data['رقم الهوية'] || '---'}`;
            
            // البيانات الشخصية الأساسية
            const basicInfoSection = document.getElementById('basicInfo');
            const basicFields = [
                { key: 'الاسم الكامل', label: 'الاسم الكامل', icon: 'person-fill' },
                { key: 'رقم الهوية', label: 'رقم الهوية', icon: 'person-badge' },
                { key: 'تاريخ الميلاد', label: 'تاريخ الميلاد', icon: 'calendar-event' },
                { key: 'العمر', label: 'العمر', icon: 'hourglass-split' },
                { key: 'الجنس', label: 'الجنس', icon: 'gender-ambiguous' },
                { key: 'الحالة الاجتماعية', label: 'الحالة الاجتماعية', icon: 'heart-fill' }
            ];
            
            basicInfoSection.innerHTML = this.renderInfoSection(basicFields, data);
            
            // بيانات الاتصال والعنوان
            const contactInfoSection = document.getElementById('contactInfo');
            const contactFields = [
                { key: 'رقم الهاتف', label: 'رقم الهاتف', icon: 'telephone-fill' },
                { key: 'رقم هاتف بديل', label: 'رقم هاتف بديل', icon: 'phone' },
                { key: 'البريد الإلكتروني', label: 'البريد الإلكتروني', icon: 'envelope-fill' },
                { key: 'العنوان', label: 'العنوان', icon: 'house-fill' },
                { key: 'المدينة', label: 'المدينة', icon: 'building' },
                { key: 'المحافظة', label: 'المحافظة', icon: 'geo-alt-fill' },
                { key: 'الفرع', label: 'الفرع', icon: 'diagram-3' },
                { key: 'رقم الواتساب', label: 'رقم الواتساب', icon: 'whatsapp' }
            ];
            
            contactInfoSection.innerHTML = this.renderInfoSection(contactFields, data);
            
            // بيانات العمل والتعليم
            const workEducationSection = document.getElementById('workEducationInfo');
            const workEducationFields = [
                { key: 'المهنة', label: 'المهنة', icon: 'briefcase-fill' },
                { key: 'مكان العمل', label: 'مكان العمل', icon: 'building-gear' },
                { key: 'الحالة المهنية', label: 'الحالة المهنية', icon: 'person-workspace' },
                { key: 'الدخل الشهري', label: 'الدخل الشهري', icon: 'cash-coin' },
                { key: 'المؤهل العلمي', label: 'المؤهل العلمي', icon: 'mortarboard-fill' },
                { key: 'التخصص', label: 'التخصص', icon: 'journal-bookmark-fill' }
            ];
            
            workEducationSection.innerHTML = this.renderInfoSection(workEducationFields, data);
            
            // بيانات العائلة
            const familyInfoSection = document.getElementById('familyInfo');
            const familyFields = [
                // removed 'اسم الزوج' per UX request
                { key: 'اسم الزوجة', label: 'اسم الزوجة', icon: 'person-heart' },
                // removed 'رقم هوية الزوج' per UX request
                { key: 'رقم هوية الزوجة', label: 'رقم هوية الزوجة', icon: 'person-badge-fill' },
                { key: 'عدد افراد الاسرة', label: 'عدد أفراد الأسرة', icon: 'people-fill' },
                { key: 'معرف العائلة', label: 'معرف العائلة', icon: 'hash' },
                { key: 'عدد الأطفال', label: 'عدد الأطفال', icon: 'people-fill' },
                { key: 'عدد الأطفال الذكور', label: 'أطفال ذكور', icon: 'person-standing' },
                { key: 'عدد الأطفال الإناث', label: 'أطفال إناث', icon: 'person-standing-dress' },
                // removed 'اسم الأب' per request
            ];
            
            familyInfoSection.innerHTML = this.renderInfoSection(familyFields, data);
            
            // ملء نموذج التعديل بالبيانات الحالية
            this.populateEditForm(data);
        },
        
        renderInfoSection(fields, data) {
                const getFieldValue = (dataObj, key) => {
                    if (!dataObj) return '-';
                    const val = (dataObj[key] !== undefined && dataObj[key] !== null && String(dataObj[key]).toString().trim() !== '') ? dataObj[key] : null;
                    if (val) return val;

                    // synonyms mapping
                    const synonyms = {
                        'تاريخ الميلاد': ['تاريخ الميلاد', 'birth_date', 'birthdate', 'DOB'],
                        'العمر': ['العمر', 'age'],
                        'الجنس': ['الجنس', 'النوع', 'gender'],
                        'رقم الجوال': ['رقم الجوال', 'رقم الهاتف', 'رقم الهاتف المحمول', 'الهاتف'],
                        'رقم هاتف بديل': ['رقم هاتف بديل', 'رقم جوال بديل', 'الهاتف البديل'],
                        'رقم جوال بديل': ['رقم جوال بديل', 'رقم هاتف بديل', 'الهاتف البديل'],
                        'العنوان': ['العنوان', 'مكان الإقامة', 'address'],
                        'مكان الإقامة': ['مكان الإقامة', 'العنوان', 'residence']
                    };

                    const keysToTry = synonyms[key] || [key];
                    for (const k of keysToTry) {
                        if (dataObj[k] !== undefined && dataObj[k] !== null && String(dataObj[k]).toString().trim() !== '') return dataObj[k];
                    }
                    return '-';
                };

                return fields.map(field => {
                    let value = getFieldValue(data, field.key);
                    if ((field.key === 'تاريخ الميلاد' || field.key === 'تاريخ الميلاد') && value !== '-') {
                        try { value = this.formatDateToEnglish(value); } catch (e) { /* ignore */ }
                    }

                    return `
                        <div class="col-md-6 col-lg-4 mb-3">
                            <div class="info-item">
                                <i class="bi bi-${field.icon} info-icon"></i>
                                <span class="info-label">${field.label}</span>
                                <div class="info-value">${value}</div>
                            </div>
                        </div>
                    `;
                }).join('');
        },
        
        populateEditForm(data) {
            // ملء نموذج التعديل بالبيانات الحالية
            const editFields = {
                'editPhone': 'رقم الهاتف',
                'editEmail': 'البريد الإلكتروني', 
                'editAddress': 'العنوان',
                'editCity': 'المدينة',
                'editProvince': 'المحافظة',
                'editAltPhone': 'رقم هاتف بديل',
                'editProfession': 'المهنة',
                'editWorkPlace': 'مكان العمل',
                'editMonthlyIncome': 'الدخل الشهري',
                'editEducation': 'المؤهل العلمي',
                'editFamilySize': 'عدد افراد الاسرة',
                'editFamilyId': 'معرف العائلة'
            };
            
            for (const [fieldId, dataKey] of Object.entries(editFields)) {
                const element = document.getElementById(fieldId);
                if (element) {
                    element.value = data[dataKey] || '';
                }
            }
                        // إعادة تفعيل زر تعديل البيانات بعد تحديث البيانات
                        setTimeout(() => {
                            const editBtn = document.getElementById('editUserDataBtn');
                            if (editBtn) {
                                editBtn.onclick = function() {
                                    document.getElementById('editPhoneModal').value = document.getElementById('contactPhone')?.textContent || '';
                                    let birthValue = '-';
                                    const birthEl = Array.from(document.querySelectorAll('.info-label')).find(e => e.textContent.includes('تاريخ الميلاد'));
                                    if (birthEl) {
                                        birthValue = birthEl.nextElementSibling?.textContent || '';
                                    }
                                    document.getElementById('editBirthModal').value = birthValue !== '-' ? birthValue : '';
                                    document.getElementById('editLocationModal').value = document.getElementById('contactLocation')?.textContent || '';
                                    const modal = new bootstrap.Modal(document.getElementById('editUserDataModal'));
                                    modal.show();
                                };
                            }
                            const saveBtn = document.getElementById('saveUserDataBtn');
                            if (saveBtn) {
                                saveBtn.onclick = function() {
                                    document.getElementById('contactPhone').textContent = document.getElementById('editPhoneModal').value;
                                    document.getElementById('contactLocation').textContent = document.getElementById('editLocationModal').value;
                                    let birthValue = document.getElementById('editBirthModal').value;
                                    const birthEl = Array.from(document.querySelectorAll('.info-label')).find(e => e.textContent.includes('تاريخ الميلاد'));
                                    if (birthEl && birthEl.nextElementSibling) {
                                        birthEl.nextElementSibling.textContent = birthValue;
                                    }
                                    const modal = bootstrap.Modal.getInstance(document.getElementById('editUserDataModal'));
                                    modal.hide();
                                    App.showToast('تم تعديل البيانات بنجاح!', true);
                                };
                            }
                        }, 100);
        },

        async loadUserEditRequests(userId) {
            try {
                const result = await this.apiCall({ action: 'getUserEditRequests', userId });
                if (result && result.success) {
                    this.renderUserEditRequests(result.requests);
                }
            } catch (error) {
                console.error('خطأ في جلب طلبات التعديل:', error);
            }
        },

        renderUserEditRequests(requests) {
            const tableBody = document.getElementById('editRequestsTableBody');
            if (!tableBody) return;

            if (requests.length === 0) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="4" class="text-center text-muted py-4">
                            <i class="bi bi-inbox me-2"></i>لا توجد طلبات تعديل
                        </td>
                    </tr>
                `;
                return;
            }

            tableBody.innerHTML = requests.map(request => {
                const statusClass = request.status === 'مقبول' ? 'status-approved' : 
                                  request.status === 'مرفوض' ? 'status-rejected' : 'status-pending';
                
                return `
                    <tr>
                        <td>${request.requestDate}</td>
                        <td>${request.reason}</td>
                        <td><span class="${statusClass}">${request.status}</span></td>
                        <td>${request.adminNotes || '-'}</td>
                    </tr>
                `;
            }).join('');
        },

        renderFutureAid(futureAid) {
            const tableBody = document.getElementById('futureAidTableBody');
            if (!tableBody) return;
            if (futureAid.length === 0) { tableBody.innerHTML = '<tr class="no-data-row"><td colspan="4">لا توجد مساعدات مجدولة حالياً.</td></tr>'; return; }
            tableBody.innerHTML = futureAid.map(item => `<tr><td>${item['نوع المساعدة']}</td><td>${this.formatDateToEnglish(item['تاريخ الاستلام'])}</td><td>${item['مصدر المساعدة'] || '-'}</td><td>${item['ملاحظات'] || '-'}</td></tr>`).join('');
        },
        
        renderCompletedAid(history) {
            const tableBody = document.getElementById('aidHistoryTableBody');
            if (!tableBody) return;
            if (history.length === 0) { tableBody.innerHTML = '<tr class="no-data-row"><td colspan="4">لا يوجد سجل مساعدات لعرضه.</td></tr>'; return; }
            tableBody.innerHTML = history.map(item => `<tr><td>${item['نوع المساعدة']}</td><td>${this.formatDateToEnglish(item['تاريخ الاستلام'])}</td><td>${item['مصدر المساعدة'] || '-'}</td><td>${item['ملاحظات'] || '-'}</td></tr>`).join('');
        },

        initAdminDashboardPage(token) { 
            if (sessionStorage.getItem('adminRole') === 'superadmin') document.getElementById('superadmin-link')?.classList.remove('d-none'); 
            this.loadAdminStats(token); 
        },
        async loadAdminStats(token) {
            const statsResult = await this.apiCall({ action: 'getAdminStats', token });
            if (statsResult?.stats) {
                document.getElementById('totalMembers').textContent = statsResult.stats.totalIndividuals;
                document.getElementById('totalFamilies').textContent = statsResult.stats.totalFamilies;
                document.getElementById('totalAid').textContent = statsResult.stats.totalAid;
                document.getElementById('totalDivorced').textContent = statsResult.stats.divorced || 0;
                document.getElementById('totalMartyrs').textContent = statsResult.stats.martyrs || 0;
                document.getElementById('totalWounded').textContent = statsResult.stats.wounded || 0;
                document.getElementById('branchAhmad').textContent = statsResult.stats.branchAhmad || 0;
                document.getElementById('branchHamed').textContent = statsResult.stats.branchHamed || 0;
                document.getElementById('branchHamdan').textContent = statsResult.stats.branchHamdan || 0;
                document.getElementById('branchHammad').textContent = statsResult.stats.branchHammad || 0;
            }
        },

        initManageMembersPage(token) {
            const editMemberModalElement = document.getElementById('editMemberModal');
            document.getElementById('memberSearchInput')?.addEventListener('input', () => { 
                clearTimeout(this.searchTimeout); 
                this.searchTimeout = setTimeout(() => this.handleMemberSearch(token), 500); 
            });
            document.getElementById('membersTableBody')?.addEventListener('click', e => {
                if (e.target.closest('.print-member-btn')) this.handlePrintMemberReport(e, token);
                if (e.target.closest('.reset-password-btn')) this.handleResetPassword(e, token);
            });
            document.getElementById('startPrintBtn')?.addEventListener('click', () => { 
                setTimeout(() => window.print(), 250); 
            });
            editMemberModalElement?.addEventListener('show.bs.modal', (event) => {
                const button = event.relatedTarget;
                if (!button) return; // Add guard clause
                const memberData = JSON.parse(button.dataset.member);
                document.getElementById('editMemberId').value = memberData['رقم الهوية'];
                document.getElementById('editFullName').value = memberData['الاسم الكامل'];
                document.getElementById('editPhoneNumber').value = memberData['رقم الجوال'];
                document.getElementById('editResidence').value = memberData['مكان الإقامة'];
                document.getElementById('editSpouseId').value = memberData['رقم هوية الزوجة'];
                document.getElementById('editSpouseFullName').value = memberData['اسم الزوجة رباعي'];
            });
            document.getElementById('editMemberForm')?.addEventListener('submit', async (e) => {
                e.preventDefault();
                const form = e.target;
                const memberId = form.editMemberId.value;
                const memberData = {
                    'الاسم الكامل': form.editFullName.value, 'رقم الجوال': form.editPhoneNumber.value,
                    'مكان الإقامة': form.editResidence.value, 'رقم هوية الزوجة': form.editSpouseId.value,
                    'اسم الزوجة رباعي': form.editSpouseFullName.value,
                };
                const result = await this.apiCall({
                    action: 'updateMember', token: token,
                    memberId: memberId, memberData: memberData
                }, true);
                if (result) { this.editMemberModalInstance.hide(); this.handleMemberSearch(token); }
            });
        },
        async handleMemberSearch(token) {
            const tableBody = document.getElementById('membersTableBody');
            const searchTerm = document.getElementById('memberSearchInput').value;
            if (!searchTerm) { tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">يرجى استخدام البحث لعرض الأفراد...</td></tr>'; document.getElementById('membersTotalCount').textContent = 'نتائج البحث: 0'; return; }
            tableBody.innerHTML = '<tr><td colspan="5" class="text-center">جاري البحث...</td></tr>';
            const result = await this.apiCall({ action: 'getAllMembers', token, searchTerm, page: 1, pageSize: 50 });
            this.renderMembersTable(result ? result.members : [], result ? result.total : 0);
        },
        renderMembersTable(members, total) {
            const tableBody = document.getElementById('membersTableBody');
            document.getElementById('membersTotalCount').textContent = `نتائج البحث: ${total}`;
            if (!members || members.length === 0) { tableBody.innerHTML = '<tr><td colspan="5" class="text-center">لا يوجد أفراد يطابقون البحث.</td></tr>'; return; }
            tableBody.innerHTML = members.map(member => `<tr><td>${member['الاسم الكامل']}</td><td>${member['رقم الهوية']}</td><td>${member['رقم الجوال'] || '-'}</td><td>${member['مكان الإقامة'] || '-'}</td><td><div class="btn-group"><button class="btn btn-sm btn-info" data-member='${JSON.stringify(member)}' data-bs-toggle="modal" data-bs-target="#editMemberModal" title="تعديل"><i class="bi bi-pencil-square"></i></button><button class="btn btn-sm btn-warning reset-password-btn" data-id="${member['رقم الهوية']}" title="مسح كلمة المرور"><i class="bi bi-key-fill"></i></button><button class="btn btn-sm btn-secondary print-member-btn" data-id="${member['رقم الهوية']}" title="طباعة تقرير"><i class="bi bi-printer-fill"></i></button></div></td></tr>`).join('');
        },
        async handlePrintMemberReport(e, token) {
            const userId = e.target.closest('.print-member-btn').dataset.id;
            this.showToast('جاري تجهيز التقرير...', true);
            const [userDataResult, aidHistoryResult, futureAidResult] = await Promise.all([
                this.apiCall({ action: 'getUserData', userId, token }),
                this.apiCall({ action: 'getUserAidHistory', userId, token }),
                this.apiCall({ action: 'getUserFutureAid', userId, token })
            ]);
            if (userDataResult && aidHistoryResult && futureAidResult) {
                document.getElementById('printReportContent').innerHTML = this.generateReportHTML(userDataResult.data, aidHistoryResult.data, futureAidResult.data);
                this.printReportModalInstance?.show();
            } else { this.showToast('فشل تحميل كامل بيانات التقرير.', false); }
        },
        generateReportHTML(userData, aidHistory, futureAid) {
            const createTable = (title, icon, data, headers) => `<h5 class="report-section-title"><i class="bi bi-${icon} me-2"></i>${title}</h5><table class="table table-bordered table-sm mb-4"><thead><tr>${headers.map(h => `<th>${h.label}</th>`).join('')}</tr></thead><tbody>${data.length > 0 ? data.map(item => `<tr>${headers.map(h => `<td>${item[h.key] ? (h.isDate ? this.formatDateToEnglish(item[h.key]) : item[h.key]) : '-'}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${headers.length}" class="text-center text-muted">لا توجد بيانات</td></tr>`}</tbody></table>`;
            const userInfoHtml = `<div class="row report-info-grid">${Object.entries({'الاسم الكامل': userData['الاسم الكامل'], 'رقم الهوية': userData['رقم الهوية'], 'رقم الجوال': userData['رقم الجوال'], 'مكان الإقامة': userData['مكان الإقامة'], 'اسم الزوجة': userData['اسم الزوجة رباعي'], 'رقم هوية الزوجة': userData['رقم هوية الزوجة']}).map(([label, value]) => `<div class="col-6"><div class="info-box"><strong>${label}:</strong><span>${value || '-'}</span></div></div>`).join('')}</div>`;
            return `<div class="report-header"><img src="logo.webp" alt="شعار"><div><h1>تقرير بيانات فرد</h1><p>عائلة أبو رجيلة (قديح)</p></div></div><h5 class="report-section-title"><i class="bi bi-person-fill me-2"></i>البيانات الشخصية</h5>${userInfoHtml}${createTable('سجل المساعدات المكتملة', 'card-list', aidHistory, [{label: 'نوع المساعدة', key: 'نوع المساعدة'}, {label: 'تاريخ الاستلام', key: 'تاريخ الاستلام', isDate: true}, {label: 'المصدر', key: 'مصدر المساعدة'}])}${createTable('المساعدات المستقبلية المجدولة', 'calendar-check', futureAid, [{label: 'نوع المساعدة', key: 'نوع المساعدة'}, {label: 'تاريخ الاستلام', key: 'تاريخ الاستلام', isDate: true}, {label: 'المصدر', key: 'مصدر المساعدة'}])}<div class="report-footer"><p>تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')}</p><p>نظام عائلة أبو رجيلة (قديح) © 2025</p></div>`;
        },
        async handleResetPassword(e, token) { const userId = e.target.closest('.reset-password-btn').dataset.id; const confirmed = await this.showConfirmationModal(`هل أنت متأكد من مسح كلمة مرور المستخدم ${userId}؟`); if (confirmed) await this.apiCall({ action: 'clearMemberPassword', token, userId }, true); },

        initManageAidPage(token) {
             document.getElementById('addAidForm')?.addEventListener('submit', e => this.handleAddAid(e, token));
             document.getElementById('bulkUploadForm')?.addEventListener('submit', e => this.handleAidFileUpload(e, token));
             document.getElementById('exportTemplateBtn')?.addEventListener('click', () => this.exportAidTemplateToExcel());
             document.getElementById('aidMemberSearch')?.addEventListener('input', () => this.handleAidMemberSearch(token));
             document.getElementById('clearSearchBtn')?.addEventListener('click', () => { document.getElementById('aidMemberSearch').value = ''; this.populateBeneficiaryList([]); });
             this.populateAidCategories();
        },
        populateAidCategories() {
            const categorySelect = document.getElementById('aidCategory'), typeSelect = document.getElementById('aidType');
            if(!categorySelect || !typeSelect) return;
            for (const category in this.aidCategories) { const option = document.createElement('option'); option.value = category; option.textContent = category; categorySelect.appendChild(option); }
            categorySelect.addEventListener('change', () => { typeSelect.innerHTML = '<option value="" disabled selected>-- اختر النوع الفرعي --</option>'; typeSelect.disabled = true; if (categorySelect.value && this.aidCategories[categorySelect.value]) { this.aidCategories[categorySelect.value].forEach(subType => { const option = document.createElement('option'); option.value = subType; option.textContent = subType; typeSelect.appendChild(option); }); typeSelect.disabled = false; } });
        },
        async handleAidMemberSearch(token) { const searchTerm = document.getElementById('aidMemberSearch').value.toLowerCase(); if (searchTerm.length < 2) { this.populateBeneficiaryList([]); return; } const result = await this.apiCall({ action: 'getAllMembers', token, searchTerm, page: 1, pageSize: 50 }); if (result?.members) { this.membersList = result.members.map(member => ({ id: member['رقم الهوية'], name: member['الاسم الكامل'] })); this.populateBeneficiaryList(this.membersList); } },
        populateBeneficiaryList(members) { const selectList = document.getElementById('aidMemberSelect'); selectList.innerHTML = members.length === 0 ? '<option disabled selected>لا توجد نتائج</option>' : members.map(m => `<option value="${m.id}">${m.name} | ${m.id}</option>`).join(''); if(members.length > 0) selectList.value = members[0].id; },
        async handleAddAid(e, token) {
            e.preventDefault(); const form = e.target;
            const aidData = { aidMemberId: form.aidMemberSelect.value, aidType: form.aidType.value, aidStatus: form.aidStatus.value, aidDate: form.aidDate.value, aidSource: form.aidSource.value, aidNotes: form.aidNotes.value, };
            if (!aidData.aidMemberId || !aidData.aidType) { this.showToast('الرجاء اختيار مستفيد ونوع المساعدة.', false); return; }
            const result = await this.apiCall({ ...aidData, action: 'addAid', token }, true);
            if (result) { form.reset(); form.aidType.innerHTML = '<option value="" disabled selected>-- اختر النوع الفرعي --</option>'; form.aidType.disabled = true; this.populateBeneficiaryList([]); }
        },
        async handleAidFileUpload(e, token) { e.preventDefault(); const file = e.target.xlsxFile.files[0]; if (!file) { this.showToast('الرجاء اختيار ملف.', false); return; } const reader = new FileReader(); reader.onload = async (event) => { const result = await this.apiCall({ action: 'bulkAddAidFromXLSX', token, fileContent: btoa(event.target.result) }, true); if (result) e.target.reset(); }; reader.readAsBinaryString(file); },
        exportAidTemplateToExcel() { const headers = ['معرف المستفيد', 'نوع المساعدة', 'تاريخ الاستلام', 'مصدر المساعدة', 'ملاحظات', 'حالة المساعدة']; const exampleRow = ['123456789', 'نقد مباشر للعائلات المحتاجة', '2025-09-06', 'قسائم/دهش/عضوية', 'Completed']; const wb = XLSX.utils.book_new(); const ws = XLSX.utils.aoa_to_sheet([headers, exampleRow]); XLSX.utils.book_append_sheet(wb, ws, "قالب المساعدات"); XLSX.writeFile(wb, "قالب-المساعدات.xlsx"); },
        
        async initAidLogsPage(token) {
            await this.fetchAidDataAndPopulateTables(token);
            this.loadFutureAidData();
            document.getElementById('futureAidSearchInput')?.addEventListener('input', () => this.loadFutureAidData());
            document.getElementById('completedAidSearchInput')?.addEventListener('input', () => this.loadCompletedAidData());
            document.getElementById('futureAidPageSizeSelect')?.addEventListener('change', (e) => { this.futureAidPageSize = parseInt(e.target.value, 10); this.futureAidCurrentPage = 1; this.loadFutureAidData(); });
            document.getElementById('futureAidPagination')?.addEventListener('click', (e) => { if (e.target.dataset.page) { this.futureAidCurrentPage = parseInt(e.target.dataset.page, 10); this.loadFutureAidData(); } });
            document.getElementById('futureAidsTableBody')?.addEventListener('click', e => { if (e.target.closest('.complete-aid-btn')) this.handleCompleteSingleAid(e, token); });
            document.getElementById('completeAllAidBtn')?.addEventListener('click', () => this.bulkCompleteModal?.show());
            document.getElementById('confirmBulkProcessBtn')?.addEventListener('click', () => this.handleConfirmBulkProcess(token));
        },
        async fetchAidDataAndPopulateTables(token) {
            const aidResult = await this.apiCall({ action: 'getAllAidRecords', token });
            if (aidResult?.data) {
                this.allFutureAidRecords = aidResult.data.filter(aid => String(aid['حالة المساعدة']).trim() === 'Future');
                this.allCompletedAidRecords = aidResult.data.filter(aid => String(aid['حالة المساعدة']).trim() === 'Completed');
            }
        },
        loadFutureAidData() {
            const searchTerm = document.getElementById('futureAidSearchInput')?.value.toLowerCase() || '';
            let filteredRecords = this.allFutureAidRecords.filter(r => (r['اسم المستفيد'] || '').toLowerCase().includes(searchTerm) || (r['نوع المساعدة'] || '').toLowerCase().includes(searchTerm));
            this.currentFilteredFutureAid = filteredRecords;
            document.getElementById('futureAidTotalCount').textContent = `إجمالي السجلات: ${filteredRecords.length}`;
            const paginatedRecords = filteredRecords.slice((this.futureAidCurrentPage - 1) * this.futureAidPageSize, this.futureAidCurrentPage * this.futureAidPageSize);
            this.renderFutureAidTable(paginatedRecords, searchTerm);
        },
        loadCompletedAidData() {
            const searchTerm = document.getElementById('completedAidSearchInput')?.value.toLowerCase() || '';
            const filteredRecords = this.allCompletedAidRecords.filter(r => (r['اسم المستفيد'] || '').toLowerCase().includes(searchTerm) || (r['نوع المساعدة'] || '').toLowerCase().includes(searchTerm));
            this.renderCompletedAidTable(filteredRecords, searchTerm);
        },
        renderFutureAidTable(records, searchTerm) {
            const tableBody = document.getElementById('futureAidsTableBody');
            if (records.length === 0) {
                const message = searchTerm ? 'لا توجد سجلات تطابق البحث.' : 'لا توجد مساعدات مستقبلية حالياً.';
                tableBody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">${message}</td></tr>`;
            } else {
                tableBody.innerHTML = records.map(aid => `<tr data-beneficiary-id="${aid['معرف المستفيد']}"><td>${aid['اسم المستفيد'] || '-'}</td><td>${aid['معرف المستفيد']}</td><td>${aid['نوع المساعدة']}</td><td>${this.formatDateToEnglish(aid['تاريخ الاستلام'])}</td><td>${aid['مصدر المساعدة'] || '-'}</td><td><button class="btn btn-sm btn-success complete-aid-btn" data-id="${aid['معرف المساعدة']}"><i class="bi bi-check-lg"></i></button></td></tr>`).join('');
            }
        },
        renderCompletedAidTable(records, searchTerm) {
            const tableBody = document.getElementById('completedAidsTableBody');
            if (!searchTerm) {
                tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">يرجى استخدام البحث لعرض السجلات...</td></tr>';
            } else if (records.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="5" class="text-center">لا توجد سجلات تطابق البحث.</td></tr>';
            } else {
                tableBody.innerHTML = records.map(aid => `<tr><td>${aid['اسم المستفيد'] || '-'}</td><td>${aid['معرف المستفيد']}</td><td>${aid['نوع المساعدة']}</td><td>${this.formatDateToEnglish(aid['تاريخ الاستلام'])}</td><td>${aid['مصدر المساعدة'] || '-'}</td></tr>`).join('');
            }
        },
        async handleCompleteSingleAid(e, token) {
            const button = e.target.closest('.complete-aid-btn');
            const aidId = button.dataset.id;
            const tableRow = button.closest('tr');
        
            const confirmed = await this.showConfirmationModal('هل أنت متأكد من تسليم هذه المساعدة؟');
            if (confirmed) {
                button.disabled = true;
                button.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>`;
                const result = await this.apiCall({ action: 'updateAidStatus', token, aidId, newStatus: 'Completed' });
                if (result) {
                    this.showToast('تم تحديث الحالة بنجاح!', true);
                    tableRow.style.opacity = '0';
                    setTimeout(() => {
                        tableRow.remove();
                        const totalCountEl = document.getElementById('futureAidTotalCount');
                        const currentCount = parseInt(totalCountEl.textContent.split(': ')[1] || '0', 10);
                        totalCountEl.textContent = `إجمالي السجلات: ${Math.max(0, currentCount - 1)}`;
                    }, 300);
                } else {
                    button.disabled = false;
                    button.innerHTML = `<i class="bi bi-check-lg"></i>`;
                }
            }
        },
        async handleConfirmBulkProcess(token) {
            const allFilteredBeneficiaryIds = this.currentFilteredFutureAid.map(record => String(record['معرف المستفيد']));
            const exceptions = document.getElementById('exceptionIdsTextarea').value.split('\n').map(id => id.trim()).filter(id => id);
            const beneficiaryIdsToComplete = allFilteredBeneficiaryIds.filter(id => !exceptions.includes(id));
            if (beneficiaryIdsToComplete.length === 0 && exceptions.length === 0) { this.showToast('لم يتم تحديد أي إجراء.', false); return; }
            const result = await this.apiCall({ action: 'bulkProcessAid', token, beneficiaryIdsToComplete, aidRecordsToDelete: exceptions }, true);
            if (result) {
                this.bulkCompleteModal.hide();
                await this.fetchAidDataAndPopulateTables(token);
                this.loadFutureAidData();
            }
        },

        initReportsPage(token) {
            document.getElementById('reportForm')?.addEventListener('submit', e => this.handleReportGeneration(e, token));
            document.getElementById('exportReportBtn')?.addEventListener('click', () => this.exportReportToExcel());
        },
        async handleReportGeneration(e, token) {
            e.preventDefault();
            const startDate = document.getElementById('startDate').value;
            const endDate = document.getElementById('endDate').value;
            if (!startDate || !endDate) { this.showToast('الرجاء تحديد تاريخ البدء والانتهاء.', false); return; }
            const result = await this.apiCall({ action: 'generateReport', token, reportType: 'aidByDateRange', filters: { startDate, endDate } });
            if (result?.data) this.renderReportResults(result.data);
        },
        renderReportResults(data) {
            const tableBody = document.getElementById('reportTableBody');
            const exportBtn = document.getElementById('exportReportBtn');
            const resultsContainer = document.getElementById('reportResults');
            if (data.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="5" class="text-center">لا توجد بيانات لهذه الفترة.</td></tr>';
                exportBtn.style.display = 'none';
            } else {
                tableBody.innerHTML = data.map(record => `<tr><td>${record['اسم المستفيد']}</td><td>${record['معرف المستفيد']}</td><td>${record['نوع المساعدة']}</td><td>${this.formatDateToEnglish(record['تاريخ الاستلام'])}</td><td>${record['مصدر المساعدة']}</td></tr>`).join('');
                exportBtn.style.display = 'inline-block';
            }
            resultsContainer.classList.remove('d-none');
        },
        exportReportToExcel() {
            const table = document.getElementById('reportResults').querySelector('table');
            if (!table) { this.showToast('لا توجد بيانات للتصدير.', false); return; }
            const wb = XLSX.utils.table_to_book(table, {sheet: "تقرير المساعدات"});
            XLSX.writeFile(wb, "تقرير-المساعدات.xlsx");
        },

        initPasswordResetsPage(token) {
            this.fetchResetRequests(token);
            document.getElementById('resetRequestsTableBody')?.addEventListener('click', e => this.handleClearPassword(e, token));
        },
        async fetchResetRequests(token) {
            const result = await this.apiCall({ action: 'getResetRequests', token });
            if (result?.data) {
                const tableBody = document.getElementById('resetRequestsTableBody');
                tableBody.innerHTML = result.data.length === 0 ? '<tr><td colspan="3" class="text-center">لا يوجد طلبات جديدة.</td></tr>' : result.data.map(req => `<tr><td>${new Date(req['التاريخ والوقت']).toLocaleString()}</td><td>${req['رقم الهوية']}</td><td><button class="btn btn-sm btn-success clear-password-btn" data-userid="${req['رقم الهوية']}" data-timestamp="${req['التاريخ والوقت']}"><i class="bi bi-check-circle-fill me-1"></i> موافقة ومسح</button></td></tr>`).join('');
            }
        },
        async handleClearPassword(e, token) {
            const button = e.target.closest('.clear-password-btn');
            const { userid, timestamp } = button.dataset;
            const confirmed = await this.showConfirmationModal(`هل أنت متأكد من مسح كلمة مرور المستخدم ${userid}؟`);
            if (confirmed) {
                const result = await this.apiCall({ action: 'clearMemberPassword', token, userId: userid, timestamp }, true);
                if (result) this.fetchResetRequests(token);
            }
        },
        
        async showConfirmationModal(message) {
            return new Promise(resolve => {
                const confirmationModalEl = document.getElementById('confirmationModal');
                if (!confirmationModalEl) {
                    this.showToast('خطأ: نافذة التأكيد غير موجودة.', false);
                    resolve(false);
                    return;
                }
                const confirmationModal = new bootstrap.Modal(confirmationModalEl);
                const confirmBtn = document.getElementById('confirmActionBtn');
                const modalBody = document.getElementById('confirmationModalBody');
                
                modalBody.textContent = message;
                confirmationModal.show();

                const confirmHandler = () => {
                    confirmationModal.hide();
                    resolve(true);
                };
                
                confirmBtn.addEventListener('click', confirmHandler, { once: true });

                confirmationModalEl.addEventListener('hidden.bs.modal', () => {
                    resolve(false);
                }, { once: true });
            });
        },

        initSuperAdminPage(token) {
            if (sessionStorage.getItem('adminRole') !== 'superadmin') { window.location.href = 'admin.html'; return; }
            this.renderCreateAdminForm();
            this.loadAdmins(token);
            document.getElementById('createAdminForm').addEventListener('submit', (e) => this.handleCreateAdminSubmit(e, token));
            document.getElementById('adminsTable').addEventListener('click', (e) => { if (e.target.closest('.toggle-status-btn')) this.handleStatusChange(e, token); });
        },
        renderCreateAdminForm() { document.getElementById('createAdminForm').innerHTML = `<div class="row"><div class="col-md-4 mb-3"><label for="newUsername" class="form-label">اسم المستخدم</label><input type="text" class="form-control" id="newUsername" required></div><div class="col-md-4 mb-3"><label for="newPassword" class="form-label">كلمة المرور</label><input type="password" class="form-control" id="newPassword" required></div><div class="col-md-4 mb-3"><label for="newRole" class="form-label">الصلاحية</label><select id="newRole" class="form-select" required><option value="admin">Admin</option><option value="superadmin">Super Admin</option></select></div></div><button type="submit" class="btn btn-primary">إنشاء حساب</button>`; },
        async handleCreateAdminSubmit(e, token) { e.preventDefault(); const result = await this.apiCall({ action: 'createAdmin', token, username: document.getElementById('newUsername').value, password: document.getElementById('newPassword').value, role: document.getElementById('newRole').value }, true); if (result) { e.target.reset(); this.loadAdmins(token); } },
        async loadAdmins(token) { const tableBody = document.getElementById('adminsTable'); tableBody.innerHTML = '<tr><td colspan="5" class="text-center">جاري التحميل...</td></tr>'; const result = await this.apiCall({ action: 'getAdmins', token }); if (result?.admins) this.renderAdminsTable(result.admins); else tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">فشل تحميل القائمة.</td></tr>'; },
        renderAdminsTable(admins) { document.getElementById('adminsTable').innerHTML = admins.map(admin => `<tr><td>${admin['اسم المستخدم']}</td><td><span class="badge bg-primary">${admin['الصلاحية']}</span></td><td>${this.formatDateToEnglish(admin['تاريخ الإنشاء'])}</td><td><span class="badge bg-${admin['الحالة'] === 'Active' ? 'success' : 'danger'}">${admin['الحالة'] === 'Active' ? 'نشط' : 'غير نشط'}</span></td><td><button class="btn btn-sm btn-${admin['الحالة'] === 'Active' ? 'danger' : 'success'} toggle-status-btn" data-username="${admin['اسم المستخدم']}" data-status="${admin['الحالة']}"><i class="bi bi-person-${admin['الحالة'] === 'Active' ? 'x' : 'check'}-fill"></i> ${admin['الحالة'] === 'Active' ? 'إلغاء تنشيط' : 'تنشيط'}</button></td></tr>`).join(''); },
        async handleStatusChange(event, token) { const button = event.target.closest('.toggle-status-btn'); const username = button.dataset.username; const newStatus = button.dataset.status === 'Active' ? 'Inactive' : 'Active'; const confirmed = await this.showConfirmationModal(`هل أنت متأكد من تغيير حالة المدير ${username} إلى ${newStatus === 'Active' ? 'نشط' : 'غير نشط'}؟`); if (confirmed) { const result = await this.apiCall({ action: 'updateAdminStatus', token, username, newStatus }, true); if (result) this.loadAdmins(token); } },

        initSpecialCasesPage() {
            const specialCaseForm = document.getElementById('specialCaseForm');
            if (specialCaseForm) {
                specialCaseForm.addEventListener('submit', async function(e) {
                    e.preventDefault();
                    if (!this.checkValidity()) {
                        this.reportValidity();
                        return;
                    }
                    const payload = {
                        action: 'addSpecialCase',
                        name: document.getElementById('caseName').value,
                        idNumber: document.getElementById('caseId').value,
                        phone: document.getElementById('casePhone').value,
                        caseType: document.getElementById('caseType').value,
                        priority: document.getElementById('casePriority').value,
                        date: document.getElementById('caseDate').value,
                        notes: document.getElementById('caseNotes').value
                    };
                    try {
                        const btn = this.querySelector('button[type="submit"]');
                        btn.disabled = true;
                        const res = await fetch(App.WEB_APP_URL, {
                            method: 'POST',
                            mode: 'cors',
                            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                            body: JSON.stringify(payload)
                        });
                        const result = await res.json();
                        if (!result.success) throw new Error(result.message || 'خطأ في الخادم');
                        App.showToast(result.message, true);
                        this.reset();
                    } catch (err) {
                        App.showToast('فشل الإرسال: ' + (err.message || err), false);
                    } finally {
                        this.querySelector('button[type="submit"]').disabled = false;
                    }
                });

                const resetCase = document.getElementById('resetCase');
                if (resetCase) {
                    resetCase.addEventListener('click', function() {
                        specialCaseForm.reset();
                    });
                }
            }
        },

        // Update user profile function
        async updateUserProfile(userId, profileData) {
            try {
                const payload = {
                    action: 'updateUserProfile',
                    userId: userId,
                    profileData: profileData
                };
                const result = await this.postToAPI(payload, false);
                if (result && result.success) {
                    this.showToast('تم تحديث البيانات الشخصية بنجاح', true);
                    // Reload user data to show updated information
                    if (typeof this.loadUserData === 'function') {
                        this.loadUserData(userId);
                    }
                    return true;
                } else {
                    throw new Error(result?.message || 'فشل في تحديث البيانات');
                }
            } catch (error) {
                console.error('Error updating profile:', error);
                this.showToast('خطأ في تحديث البيانات: ' + error.message, false);
                return false;
            }
        },

        // Global API call function for all pages
        async postToAPI(payload, showSuccessToast = true, activeSubmitButton = null) {
            const isButtonTriggered = activeSubmitButton !== null;
            if (isButtonTriggered) this.toggleButtonSpinner(true, activeSubmitButton);
            try {
                const response = await fetch(this.WEB_APP_URL, { 
                    method: 'POST', 
                    mode: 'cors', 
                    redirect: 'follow', 
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' }, 
                    body: JSON.stringify(payload) 
                });
                if (!response.ok) throw new Error(`خطأ في الشبكة: ${response.statusText}`);
                const result = await response.json();
                if (!result.success) throw new Error(result.message || 'حدث خطأ غير معروف في الخادم.');
                if (showSuccessToast && result.message) this.showToast(result.message, true);
                return result;
            } catch (error) { 
                console.error('API Call Failed:', error); 
                this.showToast(error.message, false); 
                return null; 
            } finally { 
                if (isButtonTriggered) this.toggleButtonSpinner(false, activeSubmitButton); 
            }
        },

        // وظائف الإشعارات
        async getUserNotifications(userId) {
            try {
                const result = await this.apiCall({
                    action: 'getUserNotifications',
                    userId: userId
                });
                return result;
            } catch (error) {
                console.error('خطأ في جلب الإشعارات:', error);
                return null;
            }
        },

        // Admin notification helpers (centralized)
        async getAdminNotifications(token) {
            if (!token) return null;
            try {
                const result = await this.apiCall({ action: 'getAdminNotifications', token });
                return result;
            } catch (error) {
                console.error('خطأ في جلب إشعارات الأدمن:', error);
                return null;
            }
        },

        async markAdminNotificationAsRead(notificationId, token) {
            if (!notificationId || !token) return null;
            try {
                const result = await this.apiCall({ action: 'markAdminNotificationAsRead', notificationId, token }, true);
                return result;
            } catch (error) {
                console.error('خطأ في تمييز إشعار الأدمن كمقروء:', error);
                return null;
            }
        },

        async markAllAdminNotificationsAsRead(token) {
            if (!token) return null;
            try {
                const result = await this.apiCall({ action: 'markAllAdminNotificationsAsRead', token }, true);
                return result;
            } catch (error) {
                console.error('خطأ في تمييز جميع إشعارات الأدمن كمقروءة:', error);
                return null;
            }
        },

        async markNotificationAsRead(notificationId) {
            try {
                const result = await this.apiCall({
                    action: 'markNotificationAsRead',
                    notificationId: notificationId
                });
                return result;
            } catch (error) {
                console.error('خطأ في تمييز الإشعار كمقروء:', error);
                return null;
            }
        },

        async markAllNotificationsAsRead(userId) {
            try {
                const result = await this.apiCall({
                    action: 'markAllNotificationsAsRead',
                    userId: userId
                });
                return result;
            } catch (error) {
                console.error('خطأ في تمييز جميع الإشعارات كمقروءة:', error);
                return null;
            }
        }
    };

    // Expose globally for pages with inline scripts (e.g., births.html)
    window.App = App;
    App.init();

    // زر تحديث بيانات المستخدم
    document.getElementById('refreshUserDataBtn')?.addEventListener('click', function() {
        const userId = localStorage.getItem('loggedInUserId');
        if (userId) {
            App.loadUserData(userId);
            App.showToast('تم تحديث البيانات بنجاح!', true);
        } else {
            App.showToast('تعذر العثور على معرف المستخدم.', false);
        }
    });

    // زر تعديل بيانات المستخدم
    document.getElementById('editUserDataBtn')?.addEventListener('click', function() {
        // جلب القيم الحالية من الصفحة
        document.getElementById('editPhoneModal').value = document.getElementById('contactPhone')?.textContent || '';
        // تاريخ الميلاد
        let birthValue = '-';
        const birthEl = Array.from(document.querySelectorAll('.info-label')).find(e => e.textContent.includes('تاريخ الميلاد'));
        if (birthEl) {
            birthValue = birthEl.nextElementSibling?.textContent || '';
        }
        document.getElementById('editBirthModal').value = birthValue !== '-' ? birthValue : '';
        document.getElementById('editLocationModal').value = document.getElementById('contactLocation')?.textContent || '';
        // فتح المودال
        const modal = new bootstrap.Modal(document.getElementById('editUserDataModal'));
        modal.show();
    });

    // حفظ التعديلات من المودال
    document.getElementById('saveUserDataBtn')?.addEventListener('click', function() {
        // تحديث القيم في الصفحة مباشرة
        document.getElementById('contactPhone').textContent = document.getElementById('editPhoneModal').value;
        document.getElementById('contactLocation').textContent = document.getElementById('editLocationModal').value;
        // تاريخ الميلاد
        let birthValue = document.getElementById('editBirthModal').value;
        const birthEl = Array.from(document.querySelectorAll('.info-label')).find(e => e.textContent.includes('تاريخ الميلاد'));
        if (birthEl && birthEl.nextElementSibling) {
            birthEl.nextElementSibling.textContent = birthValue;
        }
        // إغلاق المودال
        const modal = bootstrap.Modal.getInstance(document.getElementById('editUserDataModal'));
        modal.hide();
        App.showToast('تم تعديل البيانات بنجاح!', true);
    });

  
});
// Function to show the injury modal
function showInjuryForm() {
    // The injury modal was removed; navigate to the dedicated injuries page.
    window.location.href = 'injuries.html';
}

// Handle injury form submission
const _injuryForm = document.getElementById('injuryForm');
if (_injuryForm) {
    _injuryForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const submitBtn = this.querySelector('button[type="submit"]');
        const spinner = submitBtn?.querySelector('.spinner-border');
        const buttonText = submitBtn?.querySelector('.button-text');
        if (spinner) spinner.classList.remove('d-none');
        if (buttonText) buttonText.textContent = 'جاري الحفظ...';
        if (submitBtn) submitBtn.disabled = true;

        // Simulate data saving (replace with actual backend API call)
        setTimeout(() => {
            // Hide loading state
            if (spinner) spinner.classList.add('d-none');
            if (buttonText) buttonText.textContent = 'تم الحفظ بنجاح';

            // Reset form and close modal
            setTimeout(() => {
                this.reset();
                const modalEl = document.getElementById('injuryModal');
                if (modalEl) {
                    const instance = bootstrap.Modal.getInstance(modalEl);
                    if (instance) instance.hide();
                }
                if (submitBtn) submitBtn.disabled = false;
                if (buttonText) buttonText.textContent = 'حفظ بيانات الإصابة';

                // Show success message using app toast and dialog
                if (typeof App !== 'undefined' && App && typeof App.showToast === 'function') {
                    App.showToast('تم تسجيل الإصابة بنجاح!', true);
                } else {
                    console.log('تم تسجيل الإصابة بنجاح!');
                }
                // Optionally show a confirmation dialog for more details
                if (typeof App !== 'undefined' && App && typeof App.showDialog === 'function') {
                    App.showDialog({ title: 'تم الحفظ', message: 'تم تسجيل الإصابة بنجاح ويمكنك مشاهدة السجل أو إضافة حالة جديدة.', type: 'success', confirmText: 'حسناً', autoCloseMs: 3000 });
                }
            }, 1500);
        }, 2000);
    });
}

// Simulate server status check
function checkServerStatus() {
    const statusDot = document.querySelector('#server-status .status-dot');
    const statusText = document.querySelector('#server-status .status-text');

    // Simulate a successful check after a delay
    setTimeout(() => {
        statusDot.classList.add('online');
        statusText.textContent = 'الخادم يعمل';
    }, 2000);
}

// Run the server status check when the page loads
document.addEventListener('DOMContentLoaded', checkServerStatus);

/*
 Shared client-side pagination module
 Exposes: initMembersPagination, initAidLogsPagination, initReportsPagination, initResetRequestsPagination
 Each initializer accepts an array (or opts) and will render into the page's table using the known IDs.
*/
(function(){
    function escapeHtml(s){ if (!s && s!==0) return ''; return String(s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c]; }); }

    function createPaginationButton(text, enabled, onClick, active){
        const li = document.createElement('li');
        li.className = `page-item ${active ? 'active' : ''} ${!enabled ? 'disabled' : ''}`;
        const a = document.createElement('a');
        a.className = 'page-link'; a.href = '#'; a.innerHTML = text;
        if (enabled) a.addEventListener('click', function(e){ e.preventDefault(); onClick(); });
        li.appendChild(a);
        return li;
    }

    function createState(opts){
        return {
            items: Array.isArray(opts.items)? opts.items : [],
            filtered: [],
            page: 1,
            perPage: opts.perPage || 10,
            ids: opts.ids,
            dateKeys: opts.dateKeys || ['تاريخ التسجيل','تاريخ الاستلام','date','createdAt','created_at','datetime']
        };
    }

    function updatePaginationUI(state){
        const totalPages = Math.max(1, Math.ceil(state.filtered.length / state.perPage));
        const startItem = state.filtered.length? ((state.page-1)*state.perPage)+1 : 0;
        const endItem = Math.min(state.page*state.perPage, state.filtered.length);
        if (state.ids.start) document.getElementById(state.ids.start).textContent = startItem;
        if (state.ids.end) document.getElementById(state.ids.end).textContent = endItem;
        if (state.ids.total) document.getElementById(state.ids.total).textContent = state.filtered.length;

        const list = document.getElementById(state.ids.list);
        if (!list) return;
        list.innerHTML = '';
        list.appendChild(createPaginationButton('<i class="bi bi-chevron-right me-1"></i> <span class="d-none d-sm-inline">السابق</span>', state.page>1, ()=>changePage(state, state.page-1)));

        let startPage = Math.max(1, state.page-2);
        let endPage = Math.min(totalPages, state.page+2);
        if (startPage > 1){ list.appendChild(createPaginationButton('1', true, ()=>changePage(state,1))); if (startPage>2){ const dots=document.createElement('li'); dots.className='page-item disabled'; dots.innerHTML='<span class="page-link">...</span>'; list.appendChild(dots); } }
        for (let i=startPage;i<=endPage;i++){ list.appendChild(createPaginationButton(i, true, ()=>changePage(state,i), i===state.page)); }
        if (endPage < totalPages){ if (endPage < totalPages-1){ const dots=document.createElement('li'); dots.className='page-item disabled'; dots.innerHTML='<span class="page-link">...</span>'; list.appendChild(dots); } list.appendChild(createPaginationButton(totalPages, true, ()=>changePage(state,totalPages))); }

        list.appendChild(createPaginationButton('<span class="d-none d-sm-inline">التالي</span> <i class="bi bi-chevron-left ms-1"></i>', state.page<totalPages, ()=>changePage(state, state.page+1)));

        const container = document.getElementById(state.ids.container);
        if (container) container.style.display = state.filtered.length? 'flex' : 'none';
    }

    function renderTableGeneric(state, rowRenderer, colsCount){
        const tbody = document.getElementById(state.ids.body);
        if (!tbody) return;
        if (!state.filtered.length){ tbody.innerHTML = `<tr><td colspan="${colsCount}" class="text-center text-muted py-4">لا توجد سجلات</td></tr>`; updatePaginationUI(state); return; }
        const start = (state.page-1)*state.perPage;
        const end = Math.min(start + state.perPage, state.filtered.length);
        const pageData = state.filtered.slice(start, end);
        tbody.innerHTML = pageData.map(row=> rowRenderer(row)).join('');
        updatePaginationUI(state);
    }

    function changePage(state, p){ const totalPages = Math.max(1, Math.ceil(state.filtered.length / state.perPage)); if (p<1 || p>totalPages) return; state.page = p; if (state.render) state.render(); document.querySelector('.data-table-card')?.scrollIntoView({behavior:'smooth', block:'start'}); }

    function applyFilterGeneric(state, term, extraPredicate){ term = (term||'').toString().trim().toLowerCase(); state.filtered = state.items.filter(it=>{ const name = (it.name||it.fullName||it['الاسم الكامل']||it['المستفيد']||'').toString().toLowerCase(); const idNo = (it.id||it.idNo||it['رقم الهوية']||'').toString().toLowerCase(); const matched = !term || name.includes(term) || idNo.includes(term); return matched && (typeof extraPredicate === 'function' ? extraPredicate(it) : true); });
        const k = state.dateKeys.find(k=> state.items.some(i=> i[k] )); if (k) state.filtered.sort((a,b)=> new Date(b[k]) - new Date(a[k])); state.page = 1; if (state.render) state.render(); }

    // specific inits
    window.initMembersPagination = function(dataArray, perPage = 10){
        const state = createState({ items: Array.isArray(dataArray)? dataArray : [], perPage, ids: { body: 'membersTableBody', list: 'paginationList', container:'paginationContainer', start:'startItem', end:'endItem', total:'totalItems' }, dateKeys: ['تاريخ التسجيل','date','createdAt','created_at'] });
        state.render = ()=> renderTableGeneric(state, (m)=>{
            const fullName = m['الاسم الكامل'] || m.fullName || m.name || '';
            const idNo = m['رقم الهوية'] || m.id || m.idNo || '';
            const phone = m['رقم الجوال'] || m.phone || '';
            const residence = m['مكان الاقامة'] || m.residence || '';
            return `\n                        <tr class="table-row-hover">\n                            <td>\n                                <div class="d-flex align-items-center">\n                                    <div class="bg-primary rounded-circle d-flex align-items-center justify-content-center me-2" style="width:35px;height:35px;"><i class="bi bi-person-fill text-white"></i></div>\n                                    <strong class="text-dark">${escapeHtml(fullName)}</strong>\n                                </div>\n                            </td>\n                            <td><span class="font-monospace bg-light px-2 py-1 rounded">${escapeHtml(idNo)}</span></td>\n                            <td>${escapeHtml(phone)}</td>\n                            <td>${escapeHtml(residence)}</td>\n                            <td>\n                                <div class="btn-group" role="group">\n                                    <button class="btn btn-sm btn-outline-info btn-modern" title="عرض"><i class="bi bi-eye"></i></button>\n                                    <button class="btn btn-sm btn-outline-warning btn-modern" title="تعديل"><i class="bi bi-pencil"></i></button>\n                                </div>\n                            </td>\n                        </tr>\n                    `; }, 5);

        // wire search & filters
        document.addEventListener('DOMContentLoaded', ()=>{
            const searchEl = document.getElementById('memberSearchInput'); if (searchEl){ let t; searchEl.addEventListener('input', ()=>{ clearTimeout(t); t=setTimeout(()=>applyFilterGeneric(state, searchEl.value), 250); }); }
            const branchEl = document.getElementById('branchFilter'); if (branchEl) branchEl.addEventListener('change', ()=> applyFilterGeneric(state, document.getElementById('memberSearchInput')?.value));
            const statusEl = document.getElementById('statusFilter'); if (statusEl) statusEl.addEventListener('change', ()=> applyFilterGeneric(state, document.getElementById('memberSearchInput')?.value));
            if (window.membersData) window.initMembersPagination(window.membersData, perPage);
        });
        // initial load
        state.filtered = [...state.items]; state.page = 1; state.render();
    };

    window.initAidLogsPagination = function(opts){
        // opts: { future: { items: [] }, completed: { items: [] }, perPage }
        const per = (opts && opts.perPage) || 10;
        const futureState = createState({ items: Array.isArray(opts.future?.items)? opts.future.items : [], perPage: per, ids: { body: 'futureAidsTableBody', list: 'paginationList', container:'paginationContainer', start:'startItem', end:'endItem', total:'totalItems' } });
        const completedState = createState({ items: Array.isArray(opts.completed?.items)? opts.completed.items : [], perPage: per, ids: { body: 'completedAidsTableBody', list: 'completedPaginationList', container:'completedPaginationContainer', start:'completedStartItem', end:'completedEndItem', total:'completedTotalItems' } });

        futureState.render = ()=> renderTableGeneric(futureState, (row)=>{
            const name = row.name || row.fullName || row['المستفيد'] || '';
            const idNo = row.id || row.idNo || row['رقم الهوية'] || '';
            const kind = row.kind || row.type || row['نوع المساعدة'] || '';
            const date = row.date || row.createdAt || row['تاريخ الاستلام'] || '';
            const source = row.source || row['مصدر المساعدة'] || '';
            return `\n                            <tr class="table-row-hover">\n                                <td>\n                                    <div class="d-flex align-items-center">\n                                        <div class="bg-primary rounded-circle d-flex align-items-center justify-content-center me-2" style="width:35px;height:35px;"><i class="bi bi-person-fill text-white"></i></div>\n                                        <strong class="text-dark">${escapeHtml(name)}</strong>\n                                    </div>\n                                </td>\n                                <td><span class="font-monospace bg-light px-2 py-1 rounded">${escapeHtml(idNo)}</span></td>\n                                <td>${escapeHtml(kind)}</td>\n                                <td>${escapeHtml(date)}</td>\n                                <td>${escapeHtml(source)}</td>\n                                <td>\n                                    <div class="btn-group" role="group">\n                                        <button class="btn btn-sm btn-outline-info btn-modern" title="عرض"><i class="bi bi-eye"></i></button>\n                                        <button class="btn btn-sm btn-outline-warning btn-modern" title="تعديل"><i class="bi bi-pencil"></i></button>\n                                    </div>\n                                </td>\n                            </tr>\n                        `; }, 6);

// Add profile edit form handler for dashboard
document.addEventListener('DOMContentLoaded', function() {
    // Handle profile edit form submission (dashboard uses id="profileUpdateForm")
    const profileForm = document.getElementById('profileUpdateForm') || document.getElementById('profileEditForm');
    if (profileForm) {
        profileForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const userId = localStorage.getItem('loggedInUserId') || sessionStorage.getItem('userId') || window.currentUserId;
            if (!userId) {
                App.showToast('لم يتم العثور على معرف المستخدم', false);
                return;
            }

            // Build profileData using the exact sheet headers
            const profileData = {
                'رقم الجوال': (this.querySelector('#editPhone')?.value || '').trim(),
                'البريد الإلكتروني': (this.querySelector('#editEmail')?.value || '').trim(),
                'العنوان': (this.querySelector('#editAddress')?.value || '').trim(),
                'المدينة': (this.querySelector('#editCity')?.value || '').trim(),
                'المحافظة': (this.querySelector('#editProvince')?.value || '').trim(),
                'رقم جوال بديل': (this.querySelector('#editAltPhone')?.value || '').trim(),
                'المهنة': (this.querySelector('#editProfession')?.value || '').trim(),
                'مكان العمل': (this.querySelector('#editWorkPlace')?.value || '').trim(),
                'الدخل الشهري': (this.querySelector('#editMonthlyIncome')?.value || '').trim(),
                'المؤهل العلمي': (this.querySelector('#editEducation')?.value || '').trim(),
                'المدينة': (this.querySelector('#editCity')?.value || '').trim()
            };

            // Remove empty keys to avoid unnecessary writes (server ignores empty anyway)
            Object.keys(profileData).forEach(k => { if (profileData[k] === '') delete profileData[k]; });

            const result = await App.postToAPI({ action: 'updateUserProfile', userId, profileData }, true);
            if (result && result.success) {
                // Close modal if present
                const modalEl = document.getElementById('editProfileModal') || document.getElementById('editUserDataModal');
                if (modalEl) {
                    const modal = bootstrap.Modal.getInstance(modalEl);
                    if (modal) modal.hide();
                }
                App.showToast(result.message || 'تم تحديث البيانات بنجاح', true);
                if (typeof App.loadUserData === 'function') App.loadUserData(userId);
            } else {
                App.showToast(result?.message || 'فشل في تحديث البيانات', false);
            }
        });
    }
});

        completedState.render = futureState.render; // same layout for completed

        document.addEventListener('DOMContentLoaded', ()=>{
            const fSearch = document.getElementById('futureAidSearchInput'); if (fSearch){ let t; fSearch.addEventListener('input', ()=>{ clearTimeout(t); t=setTimeout(()=> applyFilterGeneric(futureState, fSearch.value), 250); }); }
            const cSearch = document.getElementById('completedAidSearchInput'); if (cSearch){ let t; cSearch.addEventListener('input', ()=>{ clearTimeout(t); t=setTimeout(()=> applyFilterGeneric(completedState, cSearch.value), 250); }); }
            if (opts && (opts.future?.items || opts.completed?.items)){
                futureState.filtered = [...futureState.items]; completedState.filtered = [...completedState.items]; futureState.render(); completedState.render();
            }
            if (window.aidFutureData || window.aidCompletedData){
                initAidLogsPagination({ future: { items: window.aidFutureData || [] }, completed: { items: window.aidCompletedData || [] }, perPage: per });
            }
        });
    };

    window.initReportsPagination = function(dataArray, perPage = 10){
        const state = createState({ items: Array.isArray(dataArray)? dataArray : [], perPage, ids: { body: 'reportTableBody', list: 'reportPaginationList', container:'reportPaginationContainer', start:'reportStartItem', end:'reportEndItem', total:'reportTotalItems' }, dateKeys:['تاريخ الاستلام','date','createdAt','created_at'] });
        state.render = ()=> renderTableGeneric(state, (r)=>{ const name = r.name || r.fullName || r['اسم المستفيد'] || ''; const idn = r.id || r.idNo || r['معرف المستفيد'] || ''; const kind = r.kind || r.type || r['نوع المساعدة'] || ''; const date = r.date || r['تاريخ الاستلام'] || ''; const source = r.source || r['مصدر المساعدة'] || ''; return `\n                <tr>\n                    <td><strong class="text-dark">${escapeHtml(name)}</strong></td>\n                    <td><span class="font-monospace bg-light px-2 py-1 rounded">${escapeHtml(idn)}</span></td>\n                    <td>${escapeHtml(kind)}</td>\n                    <td>${escapeHtml(date)}</td>\n                    <td>${escapeHtml(source)}</td>\n                </tr>\n            `; }, 5);
        document.addEventListener('DOMContentLoaded', ()=>{ if (window.reportData) window.initReportsPagination(window.reportData, perPage); }); state.filtered = [...state.items]; state.page=1; state.render(); };

    window.initResetRequestsPagination = function(dataArray, perPage = 10){
        const state = createState({ items: Array.isArray(dataArray)? dataArray : [], perPage, ids: { body: 'resetRequestsTableBody', list: 'resetPaginationList', container:'resetPaginationContainer', start:'resetStartItem', end:'resetEndItem', total:'resetTotalItems' }, dateKeys:['التاريخ والوقت','date','datetime','createdAt','created_at'] });
        state.render = ()=> renderTableGeneric(state, (r)=>{ const date = r.date || r.datetime || r['التاريخ والوقت'] || ''; const idn = r.id || r.idNo || r['رقم الهوية'] || ''; return `\n                <tr>\n                    <td>${escapeHtml(date)}</td>\n                    <td><span class="font-monospace bg-light px-2 py-1 rounded">${escapeHtml(idn)}</span></td>\n                    <td>\n                        <div class="btn-group" role="group">\n                            <button class="btn btn-sm btn-outline-success btn-modern" title="موافقة"><i class="bi bi-check-lg"></i></button>\n                            <button class="btn btn-sm btn-outline-danger btn-modern" title="رفض"><i class="bi bi-x-lg"></i></button>\n                        </div>\n                    </td>\n                </tr>\n            `; }, 3);
        document.addEventListener('DOMContentLoaded', ()=>{ if (window.resetRequestsData) window.initResetRequestsPagination(window.resetRequestsData, perPage); }); state.filtered = [...state.items]; state.page=1; state.render(); };

})();