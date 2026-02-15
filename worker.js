function parseJwt(token) {
    try {
        if (!token || token.split('.').length !== 3) return null;

        const base64 = token.split('.')[1]
            .replace(/-/g, '+')
            .replace(/_/g, '/');

        const jsonPayload = decodeURIComponent(
            atob(base64)
                .split('')
                .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
        );

        return JSON.parse(jsonPayload);
    } catch (e) {
        return null;
    }
}

// SAFE TOKEN HANDLING
const token = localStorage.getItem("token");
const user = parseJwt(token);

if (!user) {
    console.log("Invalid / Missing token → forcing logout");
    localStorage.removeItem("token");
}

// OPTIONAL DEBUG
console.log("User:", user);
