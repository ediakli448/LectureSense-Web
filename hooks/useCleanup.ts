/**
 * useCleanup Hook
 * Provides robust resource cleanup for blobs, URLs, and other disposables
 * 
 * Ensures cleanup happens even if:
 * - Component unmounts unexpectedly
 * - Errors occur during processing
 * - User navigates away
 */

import { useCallback, useEffect, useRef } from 'react';

interface CleanupResource {
  type: 'blob' | 'url' | 'custom';
  resource: Blob | string | (() => void);
  created: number;
}

interface UseCleanupReturn {
  trackBlob: (blob: Blob) => void;
  trackUrl: (url: string) => void;
  trackCustom: (cleanup: () => void) => void;
  cleanupAll: () => void;
  cleanupBlobs: () => void;
  cleanupUrls: () => void;
}

/**
 * Hook for managing resource cleanup
 * All tracked resources are automatically cleaned up on unmount
 */
export const useCleanup = (): UseCleanupReturn => {
  const resources = useRef<CleanupResource[]>([]);

  /**
   * Track a Blob for cleanup
   * Note: Blobs are automatically garbage collected when no references exist,
   * but this helps ensure we don't hold references
   */
  const trackBlob = useCallback((blob: Blob) => {
    resources.current.push({
      type: 'blob',
      resource: blob,
      created: Date.now(),
    });
  }, []);

  /**
   * Track an Object URL for cleanup
   * Object URLs MUST be explicitly revoked to free memory
   */
  const trackUrl = useCallback((url: string) => {
    if (url.startsWith('blob:')) {
      resources.current.push({
        type: 'url',
        resource: url,
        created: Date.now(),
      });
    }
  }, []);

  /**
   * Track a custom cleanup function
   */
  const trackCustom = useCallback((cleanup: () => void) => {
    resources.current.push({
      type: 'custom',
      resource: cleanup,
      created: Date.now(),
    });
  }, []);

  /**
   * Clean up all blob URLs
   */
  const cleanupUrls = useCallback(() => {
    const urlResources = resources.current.filter(r => r.type === 'url');
    
    urlResources.forEach(item => {
      try {
        URL.revokeObjectURL(item.resource as string);
      } catch (error) {
        console.warn('Failed to revoke URL:', error);
      }
    });

    // Remove cleaned resources
    resources.current = resources.current.filter(r => r.type !== 'url');
  }, []);

  /**
   * Clean up blob references
   * While JS GC handles blobs, this ensures we don't hold references
   */
  const cleanupBlobs = useCallback(() => {
    // Remove blob references from our tracking
    resources.current = resources.current.filter(r => r.type !== 'blob');
  }, []);

  /**
   * Clean up all tracked resources
   */
  const cleanupAll = useCallback(() => {
    resources.current.forEach(item => {
      try {
        switch (item.type) {
          case 'url':
            URL.revokeObjectURL(item.resource as string);
            break;
          case 'custom':
            (item.resource as () => void)();
            break;
          case 'blob':
            // Blobs don't need explicit cleanup, just release reference
            break;
        }
      } catch (error) {
        console.warn(`Cleanup error for ${item.type}:`, error);
      }
    });

    resources.current = [];
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupAll();
    };
  }, [cleanupAll]);

  // Cleanup on page unload (best effort)
  useEffect(() => {
    const handleBeforeUnload = () => {
      cleanupAll();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [cleanupAll]);

  return {
    trackBlob,
    trackUrl,
    trackCustom,
    cleanupAll,
    cleanupBlobs,
    cleanupUrls,
  };
};

/**
 * Utility: Create a blob URL and automatically track it for cleanup
 */
export const createTrackedBlobUrl = (
  blob: Blob,
  cleanup: UseCleanupReturn
): string => {
  const url = URL.createObjectURL(blob);
  cleanup.trackUrl(url);
  return url;
};

export default useCleanup;
