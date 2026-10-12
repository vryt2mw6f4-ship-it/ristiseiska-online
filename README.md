# Ristiseiska Online

Kolmen pelaajan mobiiliystävällinen selainpeli, jossa on huoneet, kutsulinkit, reaaliaikainen Socket.IO-moninpeli ja botit.

## Paikallinen käynnistys
Tarvitset Node.js 18+:n.
```bash
npm install
npm start
```
Avaa http://localhost:3000.

## Julkaisu nettiin (Render)
1. Laita projektin tiedostot GitHub-repositorioon.
2. Luo Renderissä uusi Web Service ja yhdistä repo.
3. Build command: `npm install`
4. Start command: `npm start`
5. Kun Render antaa URL:n, avaa se ja luo huone. Kopioi kutsulinkki kaverille.

## Säännöt
- 3 pelaajaa, 52 korttia, 13 korttia kullekin.
- Ruutuseiskan haltija aloittaa.
- Seiska avaa maan; 6 ja 8 tulevat seuraavaksi. Jatketaan molempiin suuntiin.
- Ässä on 1, joten se tulee kakkosen jälkeen.
- Jos kädessä on laillinen kortti, se on pakko pelata.
- Jos laillista siirtoa ei ole, nostetaan satunnainen kortti edelliseltä pelaajalta (tarvittaessa lähimmältä aiemmalta pelaajalta, jolla on kortteja).
- Sijoitukset: ensimmäinen 1 piste, toinen 2, kolmas 3.
- Botit pelaavat laillisia siirtoja yksinkertaisella strategialla.

## Rajaukset
Palvelimen muistiin tallennetut huoneet katoavat, jos palvelin käynnistyy uudelleen. Tämä on ensimmäinen versio ilman kirjautumista tai pysyvää pistetilastoa. Uusi erä -painike aloittaa uuden bottipelin uudessa huoneessa.
