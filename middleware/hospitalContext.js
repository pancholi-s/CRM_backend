import jwt from "jsonwebtoken";

export const requireHospitalContext = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(403).json({ message: "No token provided, access denied." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded.hospitalId) {
      return res.status(403).json({ message: "Access denied. No hospital context found." });
    }

    req.session.hospitalId = decoded.hospitalId;
    req.user = {
      _id: decoded._id,
      role: decoded.role,
      email: decoded.email,
    };

    next();
  } catch (error) {
    console.error("JWT verification failed:", error);
    res.status(403).json({ message: "Invalid or expired token." });
  }
};
