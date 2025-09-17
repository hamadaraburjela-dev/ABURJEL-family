/**
 * @file script.js
 * @description Frontend logic for the Family Aid System.
 * @version 9.0 - Final version incorporating all requested features and fixes.
 */

document.addEventListener('DOMContentLoaded', () => {
        const App = {
        WEB_APP_URL: 'https://script.google.com/macros/s/AKfycbwNN76USNIa7NmpdkZ-KgdtVSAEJg0XrheLUBKmUWC-MaRrUjTCr75JthZQUpIIjcNu/exec',
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
            this.initPageBasedOnURL();
            this.checkServerStatus();
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
            const adminPages = ['admin.html', 'manage-members.html', 'manage-aid.html', 'aid-logs.html', 'reports.html', 'password-resets.html', 'superadmin.html', 'events.html'];
            
            if (!token && adminPages.includes(path) && path !== 'events.html') { // events.html can be accessed without a token now
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
                'events.html': () => this.initEventsPage(token)
            };
            
            if (pageInitializers[path]) {
                await pageInitializers[path]();
            }
        },
        
        async apiCall(payload, showSuccessToast = false) {
            const activeSubmitButton = (document.activeElement?.tagName === 'BUTTON' && document.activeElement.type === 'submit') ? document.activeElement : document.querySelector('button[type="submit"]:not(:disabled)');
            const isButtonTriggered = activeSubmitButton !== null;
            if (isButtonTriggered) this.toggleButtonSpinner(true, activeSubmitButton);
            try {
                const response = await fetch(this.WEB_APP_URL, { method: 'POST', mode: 'cors', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) });
                if (!response.ok) throw new Error(`خطأ في الشبكة: ${response.statusText}`);
                const result = await response.json();
                if (!result.success) throw new Error(result.message || 'حدث خطأ غير معروف في الخادم.');
                if (showSuccessToast && result.message) this.showToast(result.message, true);
                return result;
            } catch (error) { console.error('API Call Failed:', error); this.showToast(error.message, false); return null; } finally { if (isButtonTriggered) this.toggleButtonSpinner(false, activeSubmitButton); }
        },
        
        showToast(message, isSuccess = true) { Toastify({ text: message, duration: 4000, gravity: "top", position: "center", style: { background: isSuccess ? "#28a745" : "#dc3545", boxShadow: "none" } }).showToast(); },
        toggleButtonSpinner(show, button) { const btn = button || document.querySelector('button[type="submit"]'); if (!btn) return; btn.disabled = show; btn.querySelector('.spinner-border')?.classList.toggle('d-none', !show); const buttonText = btn.querySelector('.button-text'); if(buttonText) buttonText.style.opacity = show ? 0.5 : 1; },
        formatDateToEnglish(dateString) { if (!dateString) return '-'; try { const date = new Date(dateString); if (isNaN(date.getTime())) return 'Invalid Date'; return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; } catch (error) { return dateString; } },
        
        async checkServerStatus() {
            const statusDiv = document.getElementById('server-status');
            if (!statusDiv) return;

            const statusText = statusDiv.querySelector('.status-text');

            try {
                const response = await fetch(this.WEB_APP_URL, { method: 'GET' });
                if (response.ok) {
                    const data = await response.json();
                    statusDiv.classList.remove('offline');
                    statusDiv.classList.add('online');
                    statusText.textContent = `الخادم متصل (إصدار ${data.version})`;
                } else {
                    throw new Error('Server not reachable');
                }
            } catch (error) {
                statusDiv.classList.remove('online');
                statusDiv.classList.add('offline');
                statusText.textContent = 'الخادم غير متصل';
            }
        },

        initIndexPage() {
            // ربط نماذج الدخول (تبقى كما هي)
            document.getElementById('loginForm')?.addEventListener('submit', (e) => this.handleUserLogin(e));
            document.getElementById('adminLoginForm')?.addEventListener('submit', (e) => this.handleAdminLogin(e));
            document.getElementById('setPasswordForm')?.addEventListener('submit', (e) => this.handleModalSetPassword(e));
            document.getElementById('userPasswordForm')?.addEventListener('submit', (e) => this.handleModalLogin(e));
            document.getElementById('loginModalForgotPassword')?.addEventListener('click', (e) => this.handleForgotPassword(e));
            document.getElementById('forgotPasswordForm')?.addEventListener('submit', async (e) => { e.preventDefault(); const userId = document.getElementById('forgotPasswordUserId').value; const result = await this.apiCall({ action: 'requestPasswordReset', userId }, true); if (result) this.forgotPasswordModal.hide(); });
        
            // --- الكود المحدث لصفحة الأحداث ---
            const eventsModal = document.getElementById('eventsModal');
            if (eventsModal) {
                const viewEventsTab = document.getElementById('view-events-tab');
                
                // تحميل السجل عند فتح النافذة لأول مرة
                eventsModal.addEventListener('show.bs.modal', () => {
                     this.loadEvents();
                });
        
                // ربط نموذج إضافة حدث (بدون الحاجة لصلاحيات)
                document.getElementById('addEventForm')?.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    
                    const form = e.target;
                    const payload = {
                        action: 'addEvent',
                        eventType: form.eventType.value,
                        personName: form.personName.value,
                        personId: form.personId.value,
                        eventDate: form.eventDate.value,
                        eventNotes: form.eventNotes.value,
                    };
        
                    const result = await this.apiCall(payload, true);
                    if (result) {
                        form.reset();
                        const tab = new bootstrap.Tab(viewEventsTab);
                        tab.show();
                        this.loadEvents(); // إعادة تحميل السجل
                    }
                });
            }
        },

        initDashboardPage() { const userId = localStorage.getItem('loggedInUserId'); if (!userId) { window.location.href = 'index.html'; return; } this.loadUserData(userId); },
        async handleUserLogin(e) { e.preventDefault(); const form = e.target; const userId = form.querySelector('#userId').value; const spouseId = form.querySelector('#spouseId').value; this.userLoginModal.hide(); const result = await this.apiCall({ action: 'checkPasswordStatus', id: userId, spouse_id: spouseId }); if (!result) return; if (result.message === 'password_required') { document.getElementById('modalUserId').value = userId; this.setPasswordModal.show(); } else if (result.message === 'password_exists') { document.getElementById('loginModalUserId').value = userId; document.getElementById('loginModalSpouseId').value = spouseId; this.loginPasswordModal.show(); } },
        async handleModalSetPassword(e) { e.preventDefault(); const userId = document.getElementById('modalUserId').value; const newPassword = document.getElementById('modalNewPassword').value; const confirmPassword = document.getElementById('modalConfirmPassword').value; if (newPassword !== confirmPassword) { this.showToast('كلمة المرور وتأكيدها غير متطابقين.', false); return; } if (newPassword.length < 6) { this.showToast('كلمة المرور يجب أن لا تقل عن 6 أحرف.', false); return; } const result = await this.apiCall({ action: 'setMemberPassword', userId: userId, password: newPassword }, true); if (result) { this.setPasswordModal.hide(); localStorage.setItem('loggedInUserId', userId); localStorage.setItem('loggedInUserName', result.userName); window.location.href = 'dashboard.html'; } },
        async handleModalLogin(e) { e.preventDefault(); const userId = document.getElementById('loginModalUserId').value; const spouseId = document.getElementById('loginModalSpouseId').value; const password = document.getElementById('loginModalPassword').value; this.loginPasswordModal.hide(); const result = await this.apiCall({ action: 'userLoginWithPassword', id: userId, spouse_id: spouseId, password: password }); if (result) { this.showToast(`أهلاً بك، ${result.user_name}`, true); localStorage.setItem('loggedInUserId', result.user_id); localStorage.setItem('loggedInUserName', result.user_name); setTimeout(() => { window.location.href = 'dashboard.html'; }, 1000); } },
        async handleAdminLogin(e) { e.preventDefault(); this.adminLoginModal.hide(); const result = await this.apiCall({ action: 'adminLogin', username: document.getElementById('username').value, password: document.getElementById('password').value }); if (result) { this.showToast("تم تسجيل الدخول بنجاح.", true); sessionStorage.setItem('adminToken', result.token); sessionStorage.setItem('adminRole', result.role); window.location.href = 'admin.html'; } },
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
        },
        
        renderUserInfo(data) {
            document.getElementById('userName').textContent = data['الاسم الكامل'] || 'عضو العائلة';
            document.getElementById('userTitle').textContent = `رقم الهوية: ${data['رقم الهوية'] || '---'}`;
        
            const container = document.getElementById('userInfo');
        
            const sections = {
                "البيانات الشخصية": [
                    { key: 'الاسم الكامل', label: 'الاسم الكامل', icon: 'bi-person-fill' }, { key: 'رقم الهوية', label: 'رقم الهوية', icon: 'bi-person-badge' },
                    { key: 'الحالة الاجتماعية', label: 'الحالة الاجتماعية', icon: 'bi-heart-fill' }, { key: 'تاريخ الميلاد', label: 'تاريخ الميلاد', icon: 'bi-calendar-event' },
                ],
                "بيانات العائلة": [
                    { key: 'اسم الزوجة رباعي', label: 'اسم الزوجة', icon: 'bi-person-heart' }, { key: 'رقم هوية الزوجة', label: 'رقم هوية الزوجة', icon: 'bi-person-badge-fill' },
                    { key: 'عدد الأولاد', label: 'عدد الأولاد', icon: 'bi-people-fill' },
                ],
                "معلومات التواصل": [
                    { key: 'رقم الجوال', label: 'رقم الجوال', icon: 'bi-telephone-fill' }, { key: 'مكان الإقامة', label: 'مكان الإقامة', icon: 'bi-geo-alt-fill' },
                ]
            };
        
            let html = '';
            for (const sectionTitle in sections) {
                html += `<h6 class="info-section-title">${sectionTitle}</h6>`;
                html += `<div class="row">`;
                sections[sectionTitle].forEach(field => {
                    let value = data[field.key] || '-';
                    if (field.key === 'تاريخ الميلاد' && value !== '-') { value = this.formatDateToEnglish(value); }
                    html += `<div class="col-lg-6"><div class="info-item-pro"><i class="bi ${field.icon}"></i><span class="info-label">${field.label}:</span><span class="info-value">${value}</span></div></div>`;
                });
                html += `</div>`;
            }
            container.innerHTML = html;
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

        async loadEvents() {
            const tableBody = document.getElementById('eventsTableBody');
            tableBody.innerHTML = '<tr><td colspan="4" class="text-center">جاري تحميل السجل...</td></tr>';
            
            const result = await this.apiCall({ action: 'getEvents' });
            if (result && result.data) {
                this.renderEventsTable(result.data);
            } else {
                tableBody.innerHTML = '<tr><td colspan="4" class="text-center text-danger">فشل تحميل السجل.</td></tr>';
            }
        },
        
        renderEventsTable(events) {
            const tableBody = document.getElementById('eventsTableBody');
            if (events.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">لا توجد أحداث مسجلة بعد.</td></tr>';
                return;
            }
        
            const getBadgeClass = (type) => {
                switch (type) {
                    case 'مولود جديد': return 'bg-success';
                    case 'وفاة': return 'bg-dark';
                    case 'شهادة': return 'bg-danger';
                    case 'إصابة': return 'bg-warning text-dark';
                    default: return 'bg-secondary';
                }
            };
        
            tableBody.innerHTML = events.map(event => `
                <tr>
                    <td><span class="badge ${getBadgeClass(event['نوع الحدث'])}">${event['نوع الحدث']}</span></td>
                    <td>${event['اسم الشخص المعني']}</td>
                    <td>${this.formatDateToEnglish(event['تاريخ الحدث'])}</td>
                    <td>${event['ملاحظات'] || '-'}</td>
                </tr>
            `).join('');
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
                this.searchTimeout = setTimeout(() => this.handleMemberSearch(token