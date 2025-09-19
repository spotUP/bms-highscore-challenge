import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Archive, Database, Trash2 } from "lucide-react";

interface TournamentStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (storeStats: boolean) => void;
  tournamentName: string;
}

export const TournamentStatsModal: React.FC<TournamentStatsModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  tournamentName
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg w-full mx-4 bg-gray-900 text-white border-white/20">
        <DialogHeader>
          <DialogTitle className="flex items-center text-xl font-bold text-white">
            <Archive className="w-5 h-5 mr-2" />
            Store Tournament Statistics?
          </DialogTitle>
          <DialogDescription className="text-gray-300">
            Before deleting "{tournamentName}", would you like to preserve the tournament data?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-sm text-gray-400">
            This action will permanently delete the tournament and cannot be undone.
          </div>

          <div className="grid gap-3">
            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-4">
                <div className="flex items-start space-x-3">
                  <Database className="w-5 h-5 text-blue-400 mt-1 flex-shrink-0" />
                  <div className="min-w-0">
                    <h3 className="font-medium text-white mb-1">
                      Store Statistics
                    </h3>
                    <p className="text-sm text-gray-400 break-words">
                      Preserve leaderboards, scores, and achievements for historical purposes before deletion.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-4">
                <div className="flex items-start space-x-3">
                  <Trash2 className="w-5 h-5 text-red-400 mt-1 flex-shrink-0" />
                  <div className="min-w-0">
                    <h3 className="font-medium text-white mb-1">
                      Delete Without Storing
                    </h3>
                    <p className="text-sm text-gray-400 break-words">
                      Permanently delete all tournament data without preserving statistics.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={onClose}
              className="border-gray-600 text-gray-300 hover:bg-gray-800 order-3 sm:order-1"
            >
              Cancel
            </Button>
            <Button
              onClick={() => onConfirm(false)}
              className="bg-red-600 hover:bg-red-700 text-white order-2 sm:order-2"
            >
              <Trash2 className="w-4 h-4 mr-2 flex-shrink-0" />
              <span className="truncate">Delete Without Storing</span>
            </Button>
            <Button
              onClick={() => onConfirm(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white order-1 sm:order-3"
            >
              <Database className="w-4 h-4 mr-2 flex-shrink-0" />
              <span className="truncate">Store & Delete</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};