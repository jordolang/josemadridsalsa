'use client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export function LeadsTable({ leads }: { leads: any[] }) {
  if (!leads || leads.length === 0) {
    return <div className="text-muted-foreground p-8 text-center border rounded">No leads found yet.</div>;
  }
  
  return (
    <div className="border rounded-md overflow-x-auto">
      <Table>
         <TableHeader>
           <TableRow>
             <TableHead>School</TableHead>
             <TableHead>Contact</TableHead>
             <TableHead>Title</TableHead>
             <TableHead>Sport</TableHead>
             <TableHead>Email</TableHead>
             <TableHead>Status</TableHead>
           </TableRow>
         </TableHeader>
         <TableBody>
           {leads.map(lead => (
             <TableRow key={lead.id}>
               <TableCell>
                 <div className="font-medium truncate max-w-[200px]" title={lead.schoolName}>{lead.schoolName}</div>
                 {lead.schoolUrl && (
                    <a href={lead.schoolUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline truncate block max-w-[200px]">
                      Website
                    </a>
                 )}
               </TableCell>
               <TableCell>{lead.contactName || '-'}</TableCell>
               <TableCell>{lead.title || '-'}</TableCell>
               <TableCell>{lead.sport || '-'}</TableCell>
               <TableCell>{lead.email || '-'}</TableCell>
               <TableCell>
                 <Badge variant={lead.status === 'EMAIL_SENT' ? 'default' : lead.status === 'EMAIL_FAILED' ? 'destructive' : 'outline'}>
                   {lead.status}
                 </Badge>
                 {lead.errorMessage && (
                    <p className="text-xs text-red-500 mt-1 truncate max-w-[150px]" title={lead.errorMessage}>
                      {lead.errorMessage}
                    </p>
                 )}
               </TableCell>
             </TableRow>
           ))}
         </TableBody>
      </Table>
    </div>
  );
}
