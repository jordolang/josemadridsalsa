'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Minus, RotateCcw } from 'lucide-react';
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

interface InventoryAdjustmentDialogProps {
  productId: string;
  productName: string;
}

const TRANSACTION_TYPES = [
  { value: 'RESTOCK', label: 'Restock', icon: Plus },
  { value: 'SALE', label: 'Sale', icon: Minus },
  { value: 'ADJUSTMENT', label: 'Adjustment', icon: RotateCcw },
  { value: 'RETURN', label: 'Customer Return', icon: Plus },
  { value: 'DAMAGED', label: 'Damaged/Spoiled', icon: Minus },
  { value: 'SAMPLE', label: 'Sample', icon: Minus },
];

export function InventoryAdjustmentDialog({ productId, productName }: InventoryAdjustmentDialogProps) {
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
      // Determine if quantity should be positive or negative
      let quantity = parseInt(formData.quantity, 10);

      if (isNaN(quantity) || quantity === 0) {
        toast({
          title: 'Invalid quantity',
          description: 'Please enter a valid quantity',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      // Make quantity negative for deductions
      if (['SALE', 'DAMAGED', 'SAMPLE', 'ADJUSTMENT'].includes(formData.type) && quantity > 0) {
        // For adjustments, keep the sign as entered by user
        if (formData.type !== 'ADJUSTMENT') {
          quantity = -quantity;
        }
      }

      const response = await fetch(`/api/admin/inventory/${productId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: formData.type,
          quantity,
          reason: formData.reason || undefined,
          notes: formData.notes || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to adjust inventory');
      }

      toast({
        title: 'Inventory adjusted',
        description: `Successfully updated inventory for ${productName}`,
      });

      setOpen(false);
      setFormData({
        type: 'RESTOCK',
        quantity: '',
        reason: '',
        notes: '',
      });

      router.refresh();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Adjust Stock
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Adjust Inventory</DialogTitle>
          <DialogDescription>
            Adjust stock level for {productName}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="type">Transaction Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData({ ...formData, type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
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
              <Label htmlFor="quantity">
                Quantity {['SALE', 'DAMAGED', 'SAMPLE'].includes(formData.type) && '(will be deducted)'}
              </Label>
              <Input
                id="quantity"
                type="number"
                placeholder="Enter quantity"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                required
                min="1"
              />
              <p className="text-xs text-muted-foreground">
                {formData.type === 'ADJUSTMENT'
                  ? 'Use positive numbers to add, negative to subtract'
                  : ['RESTOCK', 'RETURN'].includes(formData.type)
                  ? 'This will be added to current stock'
                  : 'This will be subtracted from current stock'}
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="reason">Reason (Optional)</Label>
              <Input
                id="reason"
                placeholder="e.g., Weekly restock, Damaged in transit"
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Additional notes..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Adjusting...' : 'Adjust Inventory'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
