import Database from 'better-sqlite3';
import fs from 'fs';

const db = new Database('public/games.db');
const genres = db.prepare('SELECT DISTINCT genre FROM games WHERE genre IS NOT NULL AND genre != ? ORDER BY genre').all('');
db.close();

const genreList = genres.map(row => row.genre).join('\n');
fs.writeFileSync('all-game-genres.txt', genreList);
console.log(`Extracted ${genres.length} unique genres to all-game-genres.txt`);