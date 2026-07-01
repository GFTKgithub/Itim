import { showDialog } from "../ui/components/dialog.js";

// --- Cloud Authentication ---
export function setupCloudAuth({ onRegister, onLogin, onLogout, onFetchData }) {
    let currentLoggedUserEmail = null;

    async function triggerExplicitLogoutSequence() {
        const verifyLogout = await showDialog({
            title: "התנתקות מהחשבון",
            message: "האם אתה בטוח שברצונך להתנתק ממערכת הסנכרון העננית?",
            icon: "🚪",
            showCancel: true,
            confirmText: "כן, התנתק",
            cancelText: "ביטול"
        });

        if (verifyLogout === true && onLogout) {
            onLogout();
        }
    }

    async function handleAuthInteraction() {
        if (currentLoggedUserEmail) {
            const confirmBtn = document.getElementById('dialogConfirmBtn');
            const cancelBtn = document.getElementById('dialogCancelBtn');
            
            let explicitButtonClick = null;

            const handleConfirmClick = () => { explicitButtonClick = 'FETCH'; };
            const handleCancelClick = () => { explicitButtonClick = 'LOGOUT'; };

            confirmBtn?.addEventListener('click', handleConfirmClick);
            cancelBtn?.addEventListener('click', handleCancelClick);

            await showDialog({
                title: "ניהול חשבון סנכרון",
                message: `מחובר כעת כחלק מ: ${currentLoggedUserEmail}`,
                icon: "☁️",
                showCancel: true,
                confirmText: "משוך נתונים מהענן",
                cancelText: "התנתק מהחשבון"
            });

            confirmBtn?.removeEventListener('click', handleConfirmClick);
            cancelBtn?.removeEventListener('click', handleCancelClick);

            if (explicitButtonClick === 'FETCH') {
                if (onFetchData) onFetchData();
            } else if (explicitButtonClick === 'LOGOUT') {
                triggerExplicitLogoutSequence();
            }

        } else {
            const confirmBtn = document.getElementById('dialogConfirmBtn');
            const cancelBtn = document.getElementById('dialogCancelBtn');
            
            let explicitButtonClick = null;

            const handleLoginPath = () => { explicitButtonClick = 'LOGIN'; };
            const handleRegisterPath = () => { explicitButtonClick = 'REGISTER'; };

            confirmBtn?.addEventListener('click', handleLoginPath);
            cancelBtn?.addEventListener('click', handleRegisterPath);

            await showDialog({
                title: "גיבוי וסנכרון בענן",
                message: "התחבר כדי לשמור את הלוח שלך בענן ולסנכרן בין מכשירים בזמן אמת.",
                icon: "🔐",
                showCancel: true,
                confirmText: "התחברות לחשבון",
                cancelText: "הרשמה לחשבון"
            });

            confirmBtn?.removeEventListener('click', handleLoginPath);
            cancelBtn?.removeEventListener('click', handleRegisterPath);

            if (explicitButtonClick === 'LOGIN') {
                openCredentialsForm('LOGIN');
            } else if (explicitButtonClick === 'REGISTER') {
                openCredentialsForm('REGISTER');
            }
        }
    }

    async function openCredentialsForm(mode) {
        const isLogin = mode === 'LOGIN';
        
        const credentials = await showDialog({
            title: isLogin ? "התחברות למערכת" : "הרשמה לחשבון חדש",
            message: isLogin ? "הזן אימייל וסיסמה כדי להתחבר:" : "הזן כתובת אימייל וסיסמה בת 6 תווים לפחות:",
            icon: "🔑",
            showCancel: true,
            confirmText: isLogin ? "התחבר" : "בצע הרשמה",
            cancelText: "חזור",
            inputs: isLogin ? [
                { label: "כתובת אימייל", type: "email", name: "email", placeholder: "you@example.com" },
                { label: "סיסמה", type: "password", name: "password", placeholder: "••••••••" }
            ] : [
                { label: "כתובת אימייל", type: "email", name: "email", placeholder: "you@example.com" },
                { label: "כינוי (שם משתמש)", type: "text", name: "nickname", placeholder: "שם משתמש" },
                { label: "סיסמה", type: "password", name: "password", placeholder: "••••••••" }
            ]
        });

        if (credentials && credentials.email && credentials.password) {
            const email = credentials.email.trim();
            const password = credentials.password;
            const nickname = credentials.nickname ? credentials.nickname.trim() : "";

            if (isLogin) {
                if (onLogin) onLogin(email, password);
            } else {
                if (onRegister) onRegister(email, password, nickname);
            }
        }
    }

    document.getElementById('openCloudAuthBtn')?.addEventListener('click', handleAuthInteraction);
    document.getElementById('settingsPanelAuthTriggerBtn')?.addEventListener('click', handleAuthInteraction);

    function updateAuthUI(userEmail) {
        currentLoggedUserEmail = userEmail;

        const globalBtnText = document.getElementById('globalCloudAuthBtnText');
        const panelRow = document.getElementById('settingsPanelCloudRow');

        if (userEmail) {
            if (globalBtnText) globalBtnText.textContent = 'החשבון שלי';
            
            if (panelRow) {
                panelRow.innerHTML = `
                    <div class="p-3 bg-slate-50 border border-slate-200/60 rounded-xl space-y-2">
                        <div class="flex flex-col">
                            <span class="text-[10px] font-bold text-slate-400">מחובר כעת:</span>
                            <span class="text-xs font-bold text-blue-900 truncate">${userEmail}</span>
                        </div>
                        <div class="grid grid-cols-2 gap-2 pt-1">
                            <button id="drawerCloudFetchBtn" class="bg-emerald-700 hover:bg-emerald-800 text-white py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all text-center">משוך נתונים</button>
                            <button id="drawerCloudLogoutBtn" class="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-100 py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all text-center">התנתק</button>
                        </div>
                    </div>
                `;
                document.getElementById('drawerCloudFetchBtn')?.addEventListener('click', () => onFetchData?.());
                document.getElementById('drawerCloudLogoutBtn')?.addEventListener('click', triggerExplicitLogoutSequence);
            }
        } else {
            if (globalBtnText) globalBtnText.textContent = 'התחברות לחשבון';
            
            if (panelRow) {
                panelRow.innerHTML = `
                    <button id="settingsPanelAuthTriggerBtn" class="w-full text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5">
                        <span>👤 התחברות / הרשמה למערכת</span>
                    </button>
                `;
                document.getElementById('settingsPanelAuthTriggerBtn')?.addEventListener('click', handleAuthInteraction);
            }
        }
    }

    return { updateAuthUI };
}