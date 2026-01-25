import 'server-only';

/**
 * Construct the public URL for a Supabase Storage object in a public bucket.
 */
export function getPublicStorageUrl(bucket: string, objectPath: string): string {
  const baseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/g, '');
  if (!baseUrl) {
    throw new Error('Missing env var: NEXT_PUBLIC_SUPABASE_URL');
  }

  const cleanBucket = String(bucket || '').replace(/^\/+|\/+$/g, '');
  const cleanPath = String(objectPath || '').replace(/^\/+/, '');

  return `${baseUrl}/storage/v1/object/public/${cleanBucket}/${cleanPath}`;
}


