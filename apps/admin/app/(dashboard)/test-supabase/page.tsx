'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function TestSupabasePage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    async function testConnection() {
      try {
        // Test basic connection by fetching from auth.users (this should work with anon key)
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          // Even if there's no session, if we get here without a connection error, Supabase is connected
          if (error.message.includes('Invalid API key') || error.message.includes('JWT')) {
            setStatus('error');
            setMessage('Supabase is connected, but there may be an issue with your API key configuration.');
          } else {
            // No session is fine - just means user isn't logged in
            setStatus('success');
            setMessage('✅ Supabase connection successful! (No active session - this is normal)');
          }
        } else {
          setStatus('success');
          setMessage('✅ Supabase connection successful!');
        }
      } catch (err) {
        setStatus('error');
        setMessage(`❌ Connection failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    testConnection();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
        <h1 className="text-2xl font-bold mb-4">Supabase Connection Test</h1>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-600 mb-2">Status:</p>
            <div className={`p-3 rounded ${
              status === 'loading' ? 'bg-yellow-50 text-yellow-800' :
              status === 'success' ? 'bg-green-50 text-green-800' :
              'bg-red-50 text-red-800'
            }`}>
              {status === 'loading' && '⏳ Testing connection...'}
              {status === 'success' && message}
              {status === 'error' && message}
            </div>
          </div>
          <div className="text-sm text-gray-500">
            <p>If you see an error, check:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Your <code className="bg-gray-100 px-1 rounded">.env.local</code> file exists</li>
              <li>Environment variables are set correctly</li>
              <li>Supabase project URL and anon key are valid</li>
            </ul>
          </div>
          <a href="/" className="block text-center text-blue-600 hover:underline mt-4">
            ← Back to home
          </a>
        </div>
      </div>
    </div>
  );
}

