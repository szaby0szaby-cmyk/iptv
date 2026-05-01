const express = require('express');
const app = express();

const port = process.env.PORT || 3000;

// Eredeti szolgáltató adatai
const IPTV_URL = process.env.IPTV_URL; 
const IPTV_USER = process.env.IPTV_USER;
const IPTV_PASS = process.env.IPTV_PASS;

// Saját, védett adatok
const MY_USER = process.env.MY_USER;
const MY_PASS = process.env.MY_PASS;

// Biztonsági ellenőrző funkció
function checkCredentials(user, pass) {
    if (!MY_USER || !MY_PASS) return false;
    return user === MY_USER && pass === MY_PASS;
}

// 1. XTREAM CODES API ÉS MŰSORÚJSÁG (EPG) TOVÁBBÍTÁSA
// Az appok a player_api.php és az xmltv.php fájlokat keresik
app.get(['/player_api.php', '/xmltv.php'], async (req, res) => {
    const { username, password } = req.query;

    // Ha rossz a TE jelszavad, megtagadjuk a hozzáférést
    if (!checkCredentials(username, password)) {
        return res.status(401).json({ error: "Hibás felhasználónév vagy jelszó!" });
    }

    try {
        // Összeállítjuk a kérést az eredeti szerver felé, de az eredeti jelszavakkal
        const urlParams = new URLSearchParams(req.query);
        urlParams.set('username', IPTV_USER);
        urlParams.set('password', IPTV_PASS);
        
        // A kérés eredeti végpontja (pl. /player_api.php vagy /xmltv.php)
        const endpoint = req.path;
        const targetUrl = `${IPTV_URL}${endpoint}?${urlParams.toString()}`;

        const response = await fetch(targetUrl);
        const data = await response.text();

        // Válasz visszaküldése (JSON vagy XML, attól függően mit kért a lejátszó)
        res.setHeader('Content-Type', response.headers.get('content-type') || 'application/json');
        res.send(data);
    } catch (error) {
        console.error('API hiba:', error);
        res.status(500).send('Hiba a szerver kommunikációjában.');
    }
});

// 2. VIDEÓ STREAMEK ÁTIRÁNYÍTÁSA (Live TV, Filmek, Sorozatok)
// Az Xtream lejátszók ilyen linkeket kérnek: /live/user/pass/12345.ts
app.get('/:type/:user/:pass/:filename', (req, res) => {
    const { type, user, pass, filename } = req.params;

    // Az elérhető típusok ellenőrzése (ne tudjanak fals linkeket beírni)
    const allowedTypes = ['live', 'movie', 'series'];
    if (!allowedTypes.includes(type)) {
        return res.status(404).send('Nem található');
    }

    // Saját jelszavad ellenőrzése streameléskor is
    if (!checkCredentials(user, pass)) {
        return res.status(401).send('Hozzáférés megtagadva a videóhoz!');
    }

    // Videó átirányítása az eredeti szolgáltatóra, hogy ne a Rendent terhelje
    const redirectUrl = `${IPTV_URL}/${type}/${IPTV_USER}/${IPTV_PASS}/${filename}`;
    res.redirect(302, redirectUrl);
});

// Szerver indítása
app.listen(port, () => {
    console.log(`IPTV Xtream Proxy elindult a ${port}-es porton.`);
});
