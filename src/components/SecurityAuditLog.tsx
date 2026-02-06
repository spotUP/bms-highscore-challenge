import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { Shield, AlertTriangle } from "lucide-react";

interface AuditLogEntry {
  id: string;
  user_id: string;
  changed_by: string;
  old_role: string | null;
  new_role: string | null;
  action: string;
  created_at: string;
}

const SecurityAuditLog = () => {
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { isAdmin } = useAuth();

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    const loadAuditLogs = async () => {
      try {
        const { data, error } = await api
          .from('role_audit_log')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) throw error;
        setAuditLogs(data || []);
      } catch (error) {
        console.error('Error loading audit logs:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAuditLogs();
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <Card className="bg-black/50 border-white/20">
        <CardContent className="p-6">
          <div className="text-center text-red-400">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
            <p>Access denied. Admin privileges required.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="bg-black/50 border-white/20">
        <CardContent className="p-6">
          <div className="text-center text-white">Loading audit logs...</div>
        </CardContent>
      </Card>
    );
  }

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'INSERT':
        return <Badge className="bg-green-600">Created</Badge>;
      case 'UPDATE':
        return <Badge className="bg-blue-600">Updated</Badge>;
      case 'DELETE':
        return <Badge className="bg-red-600">Deleted</Badge>;
      default:
        return <Badge>{action}</Badge>;
    }
  };

  return (
    <Card className="bg-black/50 border-white/20">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Security Audit Log
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="border-white/20">
              <TableHead className="text-white">Date</TableHead>
              <TableHead className="text-white">Action</TableHead>
              <TableHead className="text-white">User ID</TableHead>
              <TableHead className="text-white">Changed By</TableHead>
              <TableHead className="text-white">Role Change</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {auditLogs.map((log) => (
              <TableRow key={log.id} className="border-white/20">
                <TableCell className="text-gray-300">
                  {new Date(log.created_at).toLocaleString()}
                </TableCell>
                <TableCell>{getActionBadge(log.action)}</TableCell>
                <TableCell className="text-white font-mono text-sm">
                  {log.user_id.slice(0, 8)}...
                </TableCell>
                <TableCell className="text-white font-mono text-sm">
                  {log.changed_by ? `${log.changed_by.slice(0, 8)}...` : 'System'}
                </TableCell>
                <TableCell className="text-gray-300">
                  {log.old_role && (
                    <span className="text-red-400">{log.old_role}</span>
                  )}
                  {log.old_role && log.new_role && (
                    <span className="text-gray-500 mx-2">→</span>
                  )}
                  {log.new_role && (
                    <span className="text-green-400">{log.new_role}</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {auditLogs.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-gray-400 py-8">
                  No audit logs found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default SecurityAuditLog;