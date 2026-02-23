'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { PackagePlus } from 'lucide-react';

interface BulkAdjustmentDialogProps {
  selectedProductIds: string[];
  onComplete: () => void;
}

const TRANSACTION_TYPES = [
  { value: 'RESTOCK', label: 'Restock' },
  { value: 'ADJUSTMENT', label: 'Adjustment' },
  { value: 'DAMAGED', label: 'Damaged/Spoiled' },
  { value: 'SAMPLE', label: 'Sample' },
];

export function BulkAdjustmentDialog({ selectedProductIds, onComplete }: BulkAdjustmentDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    type: 'RESTOCK',
    quantity: '',
    reason: '',
    notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let quantity = parseInt(formData.quantity, 10);
      if (isNaN(quantity) || quantity === 0) {
        toast({ title: 'Invalid quantity', description: 'Please enter a valid quantity', variant: 'destructive' });
        setLoading(false);
        return;
      }

      // Make quantity negative for deductions
      if (['DAMAGED', 'SAMPLE'].includes(formData.type) && quantity > 0) {
        quantity = -quantity;
      }

      const adjustments = selectedProductIds.map((productId) => ({
        productId,
        type: formData.type,
        quantity,
        reason: formData.reason || undefined,
        notes: formData.notes || undefined,
      }));

      const response = await fetch('/api/admin/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adjustments }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to adjust inventory');
      }

      toast({
        title: 'Bulk adjustment complete',
        description: `Successfully adjusted ${data.data.successCount} of ${data.data.totalCount} products`,
      });

      setOpen(false);
      setFormData({ type: 'RESTOCK', quantity: '', reason: '', notes: '' });
      onComplete();
      router.refresh();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={selectedProductIds.length === 0}>
          <PackagePlus className="mr-2 h-4 w-4" />
          Bulk Adjust ({selectedProductIds.length})
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Bulk Inventory Adjustment</DialogTitle>
          <DialogDescription>
            Adjust stock for {selectedProductIds.length} selected product(s). The same quantity will be applied to all.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Transaction Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData({ ...formData, type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRANSACTION_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>
                Quantity {['DAMAGED', 'SAMPLE'].includes(formData.type) && '(will be deducted)'}
              </Label>
              <Input
                type="number"
                placeholder="Enter quantity"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                required
                min="1"
              />
            </div>

            <div className="grid gap-2">
              <Label>Reason (Optional)</Label>
              <Input
                placeholder="e.g., Weekly restock"
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label>Notes (Optional)</Label>
              <Textarea
                placeholder="Additional notes..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Adjusting...' : `Adjust ${selectedProductIds.length} Products`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
