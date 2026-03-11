import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';
import dotenv from 'dotenv';

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const isAvatar = file.fieldname === 'avatar';

    // Determine resource type: images for avatars, 'auto' for others
    const resourceType = isAvatar ? 'image' : 'auto';

    const params = {
      folder: isAvatar ? 'surplus-link-avatars' : 'surplus-link-verifications',
      resource_type: resourceType,
      public_id: `${Date.now()}-${file.originalname.split('.')[0]}`,
    };

    // If it's a PDF, we must ensure it's handled as a document and has the correct extension
    if (file.mimetype === 'application/pdf') {
      params.format = 'pdf';
      // Forcing resource_type to 'image' for PDFs allows Cloudinary to serve them as documents 
      // but ensuring the format is 'pdf' ensures the URL ends in .pdf
      params.resource_type = 'image';
    }

    return params;
  },
});

const upload = multer({ storage: storage });

export { cloudinary };
export default upload;
