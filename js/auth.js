// --- Secure PIN Hashing using Web Crypto API ---

// Helper to convert string to ArrayBuffer
function str2ab(str) {
    const buf = new ArrayBuffer(str.length * 2); // 2 bytes for each char
    const bufView = new Uint16Array(buf);
    for (let i = 0, strLen = str.length; i < strLen; i++) {
        bufView[i] = str.charCodeAt(i);
    }
    return buf;
}

// Helper to convert ArrayBuffer to hex string for storage
function ab2hex(ab) {
    return Array.from(new Uint8Array(ab)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// 1. Generate a random salt for each user
function generateSalt(length = 16) {
    const arr = new Uint8Array(length);
    window.crypto.getRandomValues(arr);
    return ab2hex(arr);
}

// 2. Hash the PIN with the salt
async function hashPIN(pin, salt) {
    const pinBuffer = str2ab(pin);
    const saltBuffer = str2ab(salt);
    const combinedBuffer = new Uint8Array(pinBuffer.byteLength + saltBuffer.byteLength);
    combinedBuffer.set(new Uint8Array(pinBuffer), 0);
    combinedBuffer.set(new Uint8Array(saltBuffer), pinBuffer.byteLength);

    const hashBuffer = await crypto.subtle.digest('SHA-256', combinedBuffer);
    return ab2hex(hashBuffer);
}

// --- Public Auth Functions ---

export async function handleRegister(alias, pin, currentUsers) {
    const aliasLower = alias.toLowerCase();
    if (currentUsers[aliasLower]) {
        return { users: currentUsers, user: null }; // User already exists
    }

    const salt = generateSalt();
    const hashedPin = await hashPIN(pin, salt);

    const newUser = {
        alias: alias,
        pinHash: hashedPin,
        salt: salt
    };

    const updatedUsers = { ...currentUsers, [aliasLower]: newUser };
    return { users: updatedUsers, user: newUser };
}


export async function handleLogin(alias, pin, currentUsers) {
    const aliasLower = alias.toLowerCase();
    const user = currentUsers[aliasLower];

    if (!user) {
        return null; // User not found
    }

    const hashedPin = await hashPIN(pin, user.salt);
    if (hashedPin === user.pinHash) {
        return user; // Login successful
    }

    return null; // Incorrect PIN
}