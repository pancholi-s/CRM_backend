import jwt from 'jsonwebtoken';  // Import jsonwebtoken to verify and decode JWT

export const requireHospitalContext = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];  // Get the token from Bearer <token>

  if (!token) {
    return res.status(403).json({ message: "No token provided, access denied." });
  }

  try {
    // Verify and decode the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);  // You should use your JWT_SECRET here

    if (!decoded.hospitalId) {
      return res.status(403).json({ message: "Access denied. No hospital context found." });
    }

    // Attach hospitalId to the request for later use
    req.session.hospitalId = decoded.hospitalId;

    next();  // Continue to the next middleware or route handler
  } catch (error) {
    console.error("JWT verification failed:", error);
    res.status(403).json({ message: "Invalid or expired token." });
  }
};
