import React, { useState } from "react";
import { Trophy, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import QRScanner from "./QRScanner";

interface ScoreEntryProps {
  onSubmit: (name: string, score: number) => void;
}

const ScoreEntry = ({ onSubmit }: ScoreEntryProps) => {
  const [name, setName] = useState("");
  const [score, setScore] = useState("");
  const [isQRScannerOpen, setIsQRScannerOpen] = useState(false);
  const [isVerified, setIsVerified] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !score) {
      toast.error("Please enter both name and score");
      return;
    }
    if (!isVerified) {
      toast.error("Please scan QR code to verify score");
      return;
    }
    onSubmit(name, parseInt(score));
    setName("");
    setScore("");
    setIsVerified(false);
    toast.success("Score submitted successfully!");
  };

  const handleQRScan = (result: string) => {
    // In a real application, you would validate the QR code content
    // For this example, we'll accept any QR code scan as valid
    setIsVerified(true);
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4 p-6 bg-black/20 rounded-lg backdrop-blur-sm">
        <h2 className="text-2xl font-bold text-arcade-neonYellow flex items-center gap-2">
          <Trophy className="animate-glow" />
          Submit Score
        </h2>
        <div className="space-y-2">
          <Input
            type="text"
            placeholder="Player Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-black/30 border-arcade-neonCyan text-white"
          />
          <Input
            type="number"
            placeholder="Score"
            value={score}
            onChange={(e) => setScore(e.target.value)}
            className="bg-black/30 border-arcade-neonPink text-white"
          />
          <Button
            type="button"
            onClick={() => setIsQRScannerOpen(true)}
            className={`w-full ${
              isVerified
                ? "bg-arcade-neonYellow hover:bg-arcade-neonYellow/80"
                : "bg-arcade-neonPink hover:bg-arcade-neonPink/80"
            } text-black font-bold mb-2 flex items-center justify-center gap-2`}
          >
            <QrCode className="w-4 h-4" />
            {isVerified ? "Verified ✓" : "Scan QR Code"}
          </Button>
          <Button 
            type="submit"
            className="w-full bg-arcade-neonCyan hover:bg-arcade-neonCyan/80 text-black font-bold"
            disabled={!isVerified}
          >
            Submit Score
          </Button>
        </div>
      </form>
      <QRScanner
        isOpen={isQRScannerOpen}
        onClose={() => setIsQRScannerOpen(false)}
        onScan={handleQRScan}
      />
    </>
  );
};

export default ScoreEntry;