import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { trpc } from '@/utils/trpc';
import { Plus, Tag, Trash2, Percent } from 'lucide-react';
import type { Coupon, CreateCouponInput } from '../../../server/src/schema';

export function CouponManagement() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [couponData, setCouponData] = useState<CreateCouponInput>({
    code: '',
    discount_type: 'percentage',
    discount_value: 10,
    max_uses: null,
    expires_at: null
  });

  const loadCoupons = useCallback(async () => {
    setIsLoading(true);
    try {
      const couponsData = await trpc.getCoupons.query();
      setCoupons(couponsData);
    } catch (error) {
      console.error('Failed to load coupons:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCoupons();
  }, [loadCoupons]);

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await trpc.createCoupon.mutate(couponData);
      setShowCreateDialog(false);
      setCouponData({
        code: '',
        discount_type: 'percentage',
        discount_value: 10,
        max_uses: null,
        expires_at: null
      });
      loadCoupons();
    } catch (error) {
      console.error('Failed to create coupon:', error);
      alert('Failed to create coupon');
    }
  };

  const handleDeactivateCoupon = async (couponId: number) => {
    try {
      await trpc.deactivateCoupon.mutate({ couponId });
      loadCoupons();
    } catch (error) {
      console.error('Failed to deactivate coupon:', error);
    }
  };

  const generateCouponCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setCouponData((prev: CreateCouponInput) => ({ ...prev, code: result }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading coupons...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center">
                <Tag className="h-6 w-6 mr-2" />
                Coupon Management
              </CardTitle>
              <CardDescription>Create and manage discount coupons</CardDescription>
            </div>
            
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Coupon
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Create New Coupon</DialogTitle>
                  <DialogDescription>Set up a discount coupon for courses</DialogDescription>
                </DialogHeader>
                
                <form onSubmit={handleCreateCoupon} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="coupon-code">Coupon Code</Label>
                    <div className="flex space-x-2">
                      <Input
                        id="coupon-code"
                        value={couponData.code}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setCouponData((prev: CreateCouponInput) => ({ ...prev, code: e.target.value.toUpperCase() }))
                        }
                        placeholder="Enter coupon code"
                        required
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={generateCouponCode}
                      >
                        Generate
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="discount-type">Discount Type</Label>
                    <Select
                      value={couponData.discount_type}
                      onValueChange={(value: 'percentage' | 'fixed') =>
                        setCouponData((prev: CreateCouponInput) => ({ ...prev, discount_type: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">Percentage (%)</SelectItem>
                        <SelectItem value="fixed">Fixed Amount ($)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="discount-value">
                      Discount Value {couponData.discount_type === 'percentage' ? '(%)' : '($)'}
                    </Label>
                    <Input
                      id="discount-value"
                      type="number"
                      step={couponData.discount_type === 'percentage' ? '1' : '0.01'}
                      min="1"
                      max={couponData.discount_type === 'percentage' ? '100' : undefined}
                      value={couponData.discount_value}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setCouponData((prev: CreateCouponInput) => ({
                          ...prev,
                          discount_value: parseFloat(e.target.value) || 0
                        }))
                      }
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="max-uses">Max Uses (optional)</Label>
                    <Input
                      id="max-uses"
                      type="number"
                      min="1"
                      value={couponData.max_uses || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setCouponData((prev: CreateCouponInput) => ({
                          ...prev,
                          max_uses: parseInt(e.target.value) || null
                        }))
                      }
                      placeholder="Unlimited"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="expires-at">Expiry Date (optional)</Label>
                    <Input
                      id="expires-at"
                      type="datetime-local"
                      value={
                        couponData.expires_at
                          ? new Date(couponData.expires_at.getTime() - couponData.expires_at.getTimezoneOffset() * 60000)
                              .toISOString().slice(0, 16)
                          : ''
                      }
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setCouponData((prev: CreateCouponInput) => ({
                          ...prev,
                          expires_at: e.target.value ? new Date(e.target.value) : null
                        }))
                      }
                    />
                  </div>
                  
                  <div className="flex justify-end space-x-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">Create Coupon</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        
        <CardContent>
          {coupons.length === 0 ? (
            <div className="text-center py-12">
              <Tag className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-600 mb-2">No Coupons Yet</h3>
              <p className="text-gray-500 mb-4">Create discount coupons to attract more students</p>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Coupon
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coupons.map((coupon: Coupon) => {
                  const isExpired = coupon.expires_at && new Date(coupon.expires_at) < new Date();
                  const isMaxedOut = coupon.max_uses && coupon.used_count >= coupon.max_uses;
                  
                  return (
                    <TableRow key={coupon.id}>
                      <TableCell className="font-mono font-bold">{coupon.code}</TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          {coupon.discount_type === 'percentage' && <Percent className="h-4 w-4 mr-1" />}
                          {coupon.discount_type === 'percentage' 
                            ? `${coupon.discount_value}%` 
                            : `$${coupon.discount_value}`
                          }
                        </div>
                      </TableCell>
                      <TableCell>
                        {coupon.used_count} / {coupon.max_uses || '∞'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          !coupon.is_active || isExpired || isMaxedOut
                            ? 'secondary' 
                            : 'default'
                        }>
                          {!coupon.is_active 
                            ? 'Deactivated'
                            : isExpired 
                            ? 'Expired'
                            : isMaxedOut
                            ? 'Max Uses Reached'
                            : 'Active'
                          }
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {coupon.expires_at 
                          ? new Date(coupon.expires_at).toLocaleDateString()
                          : 'Never'
                        }
                      </TableCell>
                      <TableCell>
                        {coupon.is_active && !isExpired && !isMaxedOut && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeactivateCoupon(coupon.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Deactivate
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}