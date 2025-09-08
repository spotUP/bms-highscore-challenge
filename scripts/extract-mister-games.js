// Script to extract game data from MiSTer arcade cores
// This will create a JSON file with all the games from the supported games column

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Game data extracted from the MiSTer arcade cores documentation
const misterGames = [
  // Arkanoid
  { name: "Arkanoid", core: "Arkanoid" },
  
  // Asteroids
  { name: "Asteroids", core: "Asteroids" },
  { name: "Asteroids Deluxe", core: "AsteroidsDeluxe" },
  
  // Astrocade
  { name: "Extra Bases", core: "Astrocade" },
  { name: "Gorf", core: "Astrocade" },
  { name: "Sea Wolf II", core: "Astrocade" },
  { name: "Space Zap", core: "Astrocade" },
  { name: "The Adventures of Robby Roto!", core: "Astrocade" },
  { name: "Wizard of Wor", core: "Astrocade" },
  
  // ATetris
  { name: "Tetris (Atari)", core: "ATetris" },
  
  // Athena
  { name: "Athena", core: "Athena" },
  { name: "Country Club", core: "Athena" },
  { name: "Fighting Golf", core: "Athena" },
  
  // Bagman
  { name: "Bagman", core: "Bagman" },
  { name: "Botanic", core: "Bagman" },
  { name: "Pickin'", core: "Bagman" },
  { name: "Squash", core: "Bagman" },
  { name: "Super Bagman", core: "Bagman" },
  
  // BankPanic
  { name: "Bank Panic", core: "BankPanic" },
  { name: "Combat Hawk", core: "BankPanic" },
  
  // BattleZone
  { name: "Battle Zone", core: "BattleZone" },
  { name: "Bradley Trainer", core: "BattleZone" },
  { name: "Red Baron", core: "BattleZone" },
  
  // Berzerk
  { name: "Berzerk", core: "Berzerk" },
  
  // BlackWidow
  { name: "Black Widow", core: "BlackWidow" },
  { name: "Gravitar", core: "BlackWidow" },
  { name: "Lunar Battle", core: "BlackWidow" },
  
  // Blockade
  { name: "Blasto", core: "Blockade" },
  { name: "Blockade", core: "Blockade" },
  { name: "CoMotion", core: "Blockade" },
  { name: "Hustle", core: "Blockade" },
  
  // BombJack
  { name: "Bomb Jack", core: "BombJack" },
  
  // Bosconian
  { name: "Bosconian - Star Destroyer", core: "Bosconian" },
  
  // Breakout
  { name: "Breakout (TTL)", core: "Breakout" },
  
  // BurgerTime
  { name: "Burger Time", core: "BurgerTime" },
  
  // BurningRubber
  { name: "Burnin' Rubber", core: "BurningRubber" },
  
  // CanyonBomber
  { name: "Canyon Bomber", core: "CanyonBomber" },
  
  // Cave
  { name: "Dangun Feveron", core: "Cave" },
  { name: "DoDonPachi", core: "Cave" },
  { name: "DonPachi", core: "Cave" },
  { name: "ESP Ra.De.", core: "Cave" },
  { name: "Fever SOS", core: "Cave" },
  { name: "Gaia Crusaders", core: "Cave" },
  { name: "Guwange", core: "Cave" },
  { name: "Puzzle Uo Poko", core: "Cave" },
  { name: "Thunder Heroes", core: "Cave" },
  
  // Centipede
  { name: "Centipede", core: "Centipede" },
  
  // Chameleon
  { name: "Chameleon", core: "Chameleon" },
  
  // ComputerSpace
  { name: "Computer Space", core: "ComputerSpace" },
  
  // CongoBongo
  { name: "Congo Bongo", core: "CongoBongo" },
  { name: "Tip Top", core: "CongoBongo" },
  
  // Cosmic
  { name: "Cosmic Alien", core: "Cosmic" },
  { name: "Devil Zone", core: "Cosmic" },
  { name: "Magical Spot", core: "Cosmic" },
  { name: "No Mans Land", core: "Cosmic" },
  { name: "Space Panic", core: "Cosmic" },
  
  // CosmicGuerilla
  { name: "Cosmic Guerilla", core: "CosmicGuerilla" },
  
  // CrazyBalloon
  { name: "Crazy Balloon", core: "CrazyBalloon" },
  
  // CrazyClimber
  { name: "Crazy Climber", core: "CrazyClimber" },
  
  // CrazyKong
  { name: "Crazy Kong", core: "CrazyKong" },
  
  // CrystalCastles
  { name: "Crystal Castles", core: "CrystalCastles" },
  
  // Defender
  { name: "Defender", core: "Defender" },
  { name: "Defender II", core: "Defender" },
  { name: "Stargate", core: "Defender" },
  
  // DigDug
  { name: "Dig Dug", core: "DigDug" },
  { name: "Dig Dug II", core: "DigDug" },
  
  // DonkeyKong
  { name: "Donkey Kong", core: "DonkeyKong" },
  { name: "Donkey Kong Jr.", core: "DonkeyKong" },
  { name: "Donkey Kong 3", core: "DonkeyKong" },
  
  // DonkeyKong3
  { name: "Donkey Kong 3", core: "DonkeyKong3" },
  
  // ElevatorAction
  { name: "Elevator Action", core: "ElevatorAction" },
  
  // Frogger
  { name: "Frogger", core: "Frogger" },
  
  // Galaga
  { name: "Galaga", core: "Galaga" },
  { name: "Galaga '88", core: "Galaga" },
  { name: "Gaplus", core: "Galaga" },
  { name: "Super Galaga", core: "Galaga" },
  
  // Galaxian
  { name: "Galaxian", core: "Galaxian" },
  
  // Gyruss
  { name: "Gyruss", core: "Gyruss" },
  
  // Joust
  { name: "Joust", core: "Joust" },
  { name: "Joust 2", core: "Joust" },
  
  // Kangaroo
  { name: "Kangaroo", core: "Kangaroo" },
  
  // LadyBug
  { name: "Lady Bug", core: "LadyBug" },
  { name: "Snap Jack", core: "LadyBug" },
  
  // MarioBros
  { name: "Mario Bros.", core: "MarioBros" },
  
  // MissileCommand
  { name: "Missile Command", core: "MissileCommand" },
  
  // MoonPatrol
  { name: "Moon Patrol", core: "MoonPatrol" },
  
  // MsPacman
  { name: "Ms. Pac-Man", core: "MsPacman" },
  { name: "Pac-Man", core: "MsPacman" },
  { name: "Pac-Man Plus", core: "MsPacman" },
  
  // Pacman
  { name: "Pac-Man", core: "Pacman" },
  { name: "Pac-Man Plus", core: "Pacman" },
  
  // Pengo
  { name: "Pengo", core: "Pengo" },
  
  // Phoenix
  { name: "Phoenix", core: "Phoenix" },
  { name: "Pleiades", core: "Phoenix" },
  
  // Pong
  { name: "Pong", core: "Pong" },
  
  // Pooyan
  { name: "Pooyan", core: "Pooyan" },
  
  // Popeye
  { name: "Popeye", core: "Popeye" },
  { name: "Sky Skipper", core: "Popeye" },
  
  // QBert
  { name: "Q*Bert", core: "QBert" },
  { name: "Mad Planets", core: "QBert" },
  
  // Rallyx
  { name: "Rally-X", core: "Rallyx" },
  { name: "New Rally-X", core: "Rallyx" },
  
  // Robotron
  { name: "Robotron 2084", core: "Robotron" },
  { name: "Alien Arena", core: "Robotron" },
  { name: "Bubbles", core: "Robotron" },
  { name: "Joust", core: "Robotron" },
  { name: "Playball", core: "Robotron" },
  { name: "Sinistar", core: "Robotron" },
  { name: "Splat!", core: "Robotron" },
  { name: "Stargate", core: "Robotron" },
  
  // RushnAttack
  { name: "Rush'n Attack", core: "RushnAttack" },
  { name: "Green Beret", core: "RushnAttack" },
  { name: "Mr. Goemon", core: "RushnAttack" },
  
  // Scramble
  { name: "Scramble", core: "Scramble" },
  { name: "Amidar", core: "Scramble" },
  { name: "Anteater", core: "Scramble" },
  { name: "Armored Car", core: "Scramble" },
  { name: "Battle of Atlantis", core: "Scramble" },
  { name: "Calipso", core: "Scramble" },
  { name: "Dark Planet", core: "Scramble" },
  { name: "Frogger (Konami)", core: "Scramble" },
  { name: "Frogger (Sega)", core: "Scramble" },
  { name: "Lost Tomb", core: "Scramble" },
  { name: "Mars", core: "Scramble" },
  { name: "Mighty Monkey", core: "Scramble" },
  { name: "Minefield", core: "Scramble" },
  { name: "Moon War", core: "Scramble" },
  { name: "Rescue", core: "Scramble" },
  { name: "Speed Coin", core: "Scramble" },
  { name: "Strategy X", core: "Scramble" },
  { name: "Super Cobra", core: "Scramble" },
  { name: "Tazz-mania", core: "Scramble" },
  { name: "The End", core: "Scramble" },
  { name: "Turtles", core: "Scramble" },
  
  // SpaceInvaders
  { name: "Space Invaders", core: "SpaceInvaders" },
  { name: "Space Invaders Part II", core: "SpaceInvaders" },
  { name: "280Z-ZZAP", core: "SpaceInvaders" },
  { name: "Amazing Maze", core: "SpaceInvaders" },
  { name: "Attack Force", core: "SpaceInvaders" },
  { name: "Balloon Bomber", core: "SpaceInvaders" },
  { name: "Blue Shark", core: "SpaceInvaders" },
  { name: "Boot Hill", core: "SpaceInvaders" },
  { name: "Clowns", core: "SpaceInvaders" },
  { name: "Cosmo", core: "SpaceInvaders" },
  { name: "Galaxy Wars", core: "SpaceInvaders" },
  { name: "Gun Fight", core: "SpaceInvaders" },
  { name: "Laguna Racer", core: "SpaceInvaders" },
  { name: "Lunar Rescue", core: "SpaceInvaders" },
  { name: "Lupin III", core: "SpaceInvaders" },
  { name: "Sea Wolf", core: "SpaceInvaders" },
  { name: "Shuffleboard", core: "SpaceInvaders" },
  { name: "Space Chaser", core: "SpaceInvaders" },
  { name: "Space Encounters", core: "SpaceInvaders" },
  { name: "Vortex", core: "SpaceInvaders" },
  
  // SpaceRace
  { name: "Space Race", core: "SpaceRace" },
  
  // Sprint1
  { name: "Sprint 1", core: "Sprint1" },
  
  // Sprint2
  { name: "Sprint 2", core: "Sprint2" },
  
  // SuperBreakout
  { name: "Super Breakout", core: "SuperBreakout" },
  
  // TankBattalion
  { name: "Tank Battalion", core: "TankBattalion" },
  
  // TimePilot
  { name: "Time Pilot", core: "TimePilot" },
  
  // TimePilot84
  { name: "Time Pilot '84", core: "TimePilot84" },
  
  // TNKIII
  { name: "TNKIII", core: "TNKIII" },
  
  // TraverseUSA
  { name: "Traverse USA", core: "TraverseUSA" },
  { name: "Shot Rider", core: "TraverseUSA" },
  
  // TurkeyShoot
  { name: "Turkey Shoot", core: "TurkeyShoot" },
  
  // Ultratank
  { name: "Ultra Tank", core: "Ultratank" },
  
  // VBall
  { name: "V'Ball", core: "VBall" },
  
  // Xevious
  { name: "Xevious", core: "Xevious" },
  { name: "Super Xevious", core: "Xevious" },
  
  // Zaxxon
  { name: "Zaxxon", core: "Zaxxon" },
  { name: "Super Zaxxon", core: "Zaxxon" },
  { name: "Future Spy", core: "Zaxxon" },
  
  // ZigZag
  { name: "Zig Zag", core: "ZigZag" }
];

// Save the games data to a JSON file
const outputPath = path.join(__dirname, '..', 'src', 'data', 'mister-games.json');

// Ensure the data directory exists
const dataDir = path.dirname(outputPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

fs.writeFileSync(outputPath, JSON.stringify(misterGames, null, 2));

console.log(`Extracted ${misterGames.length} games from MiSTer arcade cores`);
console.log(`Saved to: ${outputPath}`);

export default misterGames;
