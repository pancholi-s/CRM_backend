export const paginationMiddleware = (req, res, next) => {
    let page = parseInt(req.query.page, 10) || 1;
    let limit = parseInt(req.query.limit, 10) || 10;
  
    // Ensure page and limit are positive integers
    if (isNaN(page) || page <= 0) {
      page = 1;
    }
    if (isNaN(limit) || limit <= 0) {
      limit = 10; // Default limit
    }
  
    // Attach pagination values to the request object
    req.pagination = {
      page,
      limit,
      skip: (page - 1) * limit,
    };
  
    next();
  };
  