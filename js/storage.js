const GLOBAL_LS = { users: "mh_users_v2", current: "mh_user_current_v2" };
const NS_PREFIX = "mh_v2_";

export function nsKey(userAlias) {
    return NS_PREFIX + userAlias + "_state";
}

// --- User Profile Storage ---
export function loadUsers() {
    try {
        return JSON.parse(localStorage.getItem(GLOBAL_LS.users) || "{}");
    } catch (e) {
        console.error("Error loading users:", e);
        return {};
    }
}

export function saveUsers(users) {
    try {
        localStorage.setItem(GLOBAL_LS.users, JSON.stringify(users));
    } catch (e) {
        console.error("Error saving users:", e);
    }
}

export function loadCurrentUser() {
    return localStorage.getItem(GLOBAL_LS.current) || null;
}

export function setCurrent(alias) {
    if (alias) {
        localStorage.setItem(GLOBAL_LS.current, alias);
    } else {
        localStorage.removeItem(GLOBAL_LS.current);
    }
}

// --- User Data Storage ---
export function loadUserData(alias) {
    try {
        const key = nsKey(alias.toLowerCase());
        return JSON.parse(localStorage.getItem(key) || "{}");
    } catch (e) {
        console.error("Error loading user data:", e);
        return {};
    }
}

export function saveUserData(alias, data) {
    try {
        const key = nsKey(alias.toLowerCase());
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
        console.error("Error saving user data:", e);
        alert("Error al guardar datos. La memoria local podría estar llena.");
    }
}