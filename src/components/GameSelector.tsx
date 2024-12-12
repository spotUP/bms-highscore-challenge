import { Button } from "@/components/ui/button";

interface Game {
  id: string;
  name: string;
}

interface GameSelectorProps {
  games: Game[];
  selectedGame: string;
  onSelect: (gameId: string) => void;
}

const GameSelector = ({ games, selectedGame, onSelect }: GameSelectorProps) => {
  return (
    <div className="flex gap-2 overflow-x-auto pb-4">
      {games.map((game) => (
        <Button
          key={game.id}
          onClick={() => onSelect(game.id)}
          className={`
            whitespace-nowrap
            ${selectedGame === game.id
              ? 'bg-arcade-neonPink text-white'
              : 'bg-black/20 text-white hover:bg-arcade-neonPink/20'}
          `}
        >
          {game.name}
        </Button>
      ))}
    </div>
  );
};

export default GameSelector;