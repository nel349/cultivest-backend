import express from 'express';
import { moonPayService } from '../../../utils/moonpay';
import { verifyJWT } from '../../../utils/auth';

const router = express.Router();

interface SignUrlRequest {
  url: string;
}

router.post('/', async (req, res) => {
  try {
    const { url }: SignUrlRequest = req.body;
    const authHeader = req.headers.authorization;

    // Validate request
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter: url'
      });
    }

    // Validate JWT authentication
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Authorization token required'
      });
    }

    // Extract and verify JWT token
    const token = authHeader.split(' ')[1];
    const decoded = verifyJWT(token);
    
    if (!decoded) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }
    
    console.log('🔐 Authenticated user for URL signing:', decoded.userId);

    // Extract query string from the URL for signing
    const urlObj = new URL(url);
    const queryString = urlObj.search.substring(1); // Remove the leading '?'
    
    if (!queryString) {
      return res.status(400).json({
        success: false,
        error: 'Invalid URL format - no query parameters found'
      });
    }

    console.log('🔑 Signing MoonPay URL:', { 
      userId: decoded.userId,
      queryLength: queryString.length,
      url: url.substring(0, 100) + '...' // Log first 100 chars for debugging
    });

    // Create signature using the moonPayService
    const signature = moonPayService.createSignature(queryString);

    return res.json({
      success: true,
      signature: signature,
      message: 'URL signed successfully'
    });

  } catch (error) {
    console.error('MoonPay URL signing error:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Internal server error while signing URL' 
    });
  }
});

export default router;