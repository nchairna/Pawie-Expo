'use client';

/**
 * Admin Autoship Actions Component (Client)
 * Phase 5 - Autoship System
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import type { Autoship } from '@/lib/types';
import { supabase } from '@/lib/supabase-client';

interface AutoshipActionsProps {
  autoship: Autoship;
}

export function AutoshipActions({ autoship }: AutoshipActionsProps) {
  const router = useRouter();
  const [isPauseDialogOpen, setIsPauseDialogOpen] = useState(false);
  const [isResumeDialogOpen, setIsResumeDialogOpen] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handlePause = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc('pause_autoship', {
        p_autoship_id: autoship.id,
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to pause autoship');
      }

      toast.success('Autoship paused successfully');
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || 'Failed to pause autoship');
    } finally {
      setIsLoading(false);
      setIsPauseDialogOpen(false);
    }
  };

  const handleResume = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc('resume_autoship', {
        p_autoship_id: autoship.id,
        p_next_run_at: null,
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to resume autoship');
      }

      toast.success('Autoship resumed successfully');
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || 'Failed to resume autoship');
    } finally {
      setIsLoading(false);
      setIsResumeDialogOpen(false);
    }
  };

  const handleCancel = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc('cancel_autoship', {
        p_autoship_id: autoship.id,
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to cancel autoship');
      }

      toast.success('Autoship cancelled successfully');
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || 'Failed to cancel autoship');
    } finally {
      setIsLoading(false);
      setIsCancelDialogOpen(false);
    }
  };

  return (
    <div className="flex gap-2">
      {autoship.status === 'active' && (
        <>
          <Button
            variant="outline"
            onClick={() => setIsPauseDialogOpen(true)}
            disabled={isLoading}
          >
            Pause Autoship
          </Button>
          <AlertDialog open={isPauseDialogOpen} onOpenChange={setIsPauseDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Pause Autoship?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will temporarily pause the autoship subscription. No deliveries will be
                  created until it is resumed.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handlePause} disabled={isLoading}>
                  {isLoading ? 'Pausing...' : 'Pause Autoship'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}

      {autoship.status === 'paused' && (
        <>
          <Button onClick={() => setIsResumeDialogOpen(true)} disabled={isLoading}>
            Resume Autoship
          </Button>
          <AlertDialog open={isResumeDialogOpen} onOpenChange={setIsResumeDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Resume Autoship?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will reactivate the autoship subscription. The next delivery will be
                  scheduled based on the frequency.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleResume} disabled={isLoading}>
                  {isLoading ? 'Resuming...' : 'Resume Autoship'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}

      {autoship.status !== 'cancelled' && (
        <>
          <Button
            variant="destructive"
            onClick={() => setIsCancelDialogOpen(true)}
            disabled={isLoading}
          >
            Cancel Autoship
          </Button>
          <AlertDialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancel Autoship?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently cancel the autoship subscription. This action cannot be
                  undone. The customer will need to create a new autoship if they want to
                  resubscribe.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Go Back</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleCancel}
                  disabled={isLoading}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isLoading ? 'Cancelling...' : 'Cancel Autoship'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}

      {autoship.status === 'cancelled' && (
        <p className="text-sm text-muted-foreground py-2">
          This autoship has been cancelled and cannot be modified.
        </p>
      )}
    </div>
  );
}
