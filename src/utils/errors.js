
// Takes an error code and returns a user-friendly Firebase error string
export function getFriendlyFirebaseErrorMessage(errorCode) {
    switch (errorCode) {
        case 'auth/email-already-in-use':
            return 'האימייל הזה כבר תפוס במערכת.';
        case 'auth/invalid-email':
            return 'כתובת האימייל אינה תקינה.';
        case 'auth/weak-password':
            return 'הסיסמה חלשה מדי. אנא השתמש ב-6 תווים לפחות.';
        case 'auth/invalid-credential':
            return 'פרטי ההתחברות שגויים. בדוק את האימייל או הסיסמה.';
        default:
            return 'התרחשה שגיאה לא צפויה. נסה שוב מאוחר יותר.';
    }
  }