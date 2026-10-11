/**
 * Cloudinary V2 storage. When Cloudinary credentials aren't configured,
 * documents are stored on local disk in server/uploads instead.
 */

import { v2 as cloudinary } from 'cloudinary';

let _configured = null;

export function cloudinaryEnabled() {
  if (_configured === null) {
    const { CLOUDINARY_CLOUD_NAME: name, CLOUDINARY_API_KEY: key, CLOUDINARY_API_SECRET: secret } = process.env;
    _configured = !!(name && key && secret && !name.startsWith('your_') && !key.startsWith('your_'));
    if (_configured) cloudinary.config({ cloud_name: name, api_key: key, api_secret: secret, secure: true });
  }
  return _configured;
}

function resourceType(mimetype) {
  return mimetype.startsWith('image/') ? 'image' : 'raw';
}

export function uploadBuffer(buffer, { filename, mimetype }) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder:          'ibbulai/documents',
        resource_type:   resourceType(mimetype),
        use_filename:    true,
        unique_filename: true,
        filename_override: filename,
      },
      (err, result) => (err ? reject(err) : resolve({ publicId: result.public_id, url: result.secure_url }))
    );
    stream.end(buffer);
  });
}

export async function deleteFile(publicId, mimetype) {
  await cloudinary.uploader.destroy(publicId, { resource_type: resourceType(mimetype) });
}
