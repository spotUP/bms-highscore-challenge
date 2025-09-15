import React, { useState } from 'react';
import { useBrackets } from '@/contexts/BracketContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Pencil, Trash2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const BracketManagement: React.FC = () => {
  const { tournaments, deleteTournament, renameTournament } = useBrackets();
  const { toast } = useToast();
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [selectedTournament, setSelectedTournament] = useState<any>(null);
  const [newName, setNewName] = useState('');

  const handleRename = async () => {
    if (!selectedTournament || !newName.trim()) return;

    const success = await renameTournament(selectedTournament.id, newName.trim());
    if (success) {
      toast({
        title: "Tournament Renamed",
        description: `Tournament renamed to "${newName.trim()}"`,
      });
      setRenameDialogOpen(false);
      setSelectedTournament(null);
      setNewName('');
    } else {
      toast({
        title: "Failed to Rename",
        description: "Could not rename tournament. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (tournament: any) => {
    const success = await deleteTournament(tournament.id);
    if (success) {
      toast({
        title: "Tournament Deleted",
        description: `"${tournament.name}" has been deleted`,
      });
    } else {
      toast({
        title: "Failed to Delete",
        description: "Could not delete tournament. Please try again.",
        variant: "destructive"
      });
    }
  };

  const openRenameDialog = (tournament: any) => {
    setSelectedTournament(tournament);
    setNewName(tournament.name);
    setRenameDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="text-gray-300">
        Manage Bracket Tournaments: rename or delete existing tournaments.
      </div>

      {tournaments.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          No Bracket Tournaments found.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tournament Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tournaments.map((tournament) => (
              <TableRow key={tournament.id}>
                <TableCell className="font-medium">{tournament.name}</TableCell>
                <TableCell>
                  <span className={`px-2 py-1 rounded text-xs ${
                    tournament.status === 'active' ? 'bg-green-800 text-green-100' :
                    tournament.status === 'completed' ? 'bg-blue-800 text-blue-100' :
                    'bg-gray-800 text-gray-100'
                  }`}>
                    {tournament.status}
                  </span>
                </TableCell>
                <TableCell>
                  {new Date(tournament.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openRenameDialog(tournament)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-gray-900 text-white border-white/20">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Tournament</AlertDialogTitle>
                          <AlertDialogDescription className="text-gray-300">
                            Are you sure you want to delete "{tournament.name}"? This will permanently delete the tournament, all its players, and all match data. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="bg-gray-800 text-white hover:bg-gray-700">
                            Cancel
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(tournament)}
                            className="bg-red-600 text-white hover:bg-red-700"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent className="bg-gray-900 text-white border-white/20">
          <DialogHeader>
            <DialogTitle>Rename Tournament</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-300">Tournament Name</label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Enter new tournament name"
                className="mt-1 bg-gray-800 border-gray-700 text-white"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRenameDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRename}
              disabled={!newName.trim() || newName.trim() === selectedTournament?.name}
            >
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BracketManagement;