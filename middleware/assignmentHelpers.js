export const mapAssignedByModel = (req, res, next) => {
  const roleModelMap = {
    'doctor': 'Doctor',
    'hospitaladmin': 'HospitalAdmin',
    'receptionist': 'Receptionist',
    'staff': 'Staff'
  };
  
  req.assignedByModel = roleModelMap[req.user.role.toLowerCase()] || 'Doctor';
  next();
};

export const prepareAssignmentData = (req, res, next) => {
  const { assignmentType, doctorIds, staffIds, patientIds, role, shift, duration } = req.body;
  const hospitalId = req.session.hospitalId;
  const assignedBy = req.user._id;

  let departmentId = null;

  if (assignmentType === "doctor" && req.validatedDoctors) {
    departmentId = req.validatedDoctors[0].departments[0];
  } else if (assignmentType === "staff" && req.validatedStaff) {
    departmentId = req.validatedStaff[0].department;
  }

  const assignmentData = {
    patients: patientIds,
    hospital: hospitalId,
    department: departmentId,
    assignmentType,
    role,
    shift,
    duration,
    assignedBy,
    assignedByModel: req.assignedByModel,
    status: "Active",
  };

  if (assignmentType === "doctor") {
    assignmentData.doctors = doctorIds;
  } else {
    assignmentData.staff = staffIds;
  }

  req.assignmentData = assignmentData;
  next();
};

export const buildAssignmentFilters = (req, res, next) => {
  const hospitalId = req.session.hospitalId;
  const {
    assignmentType,
    doctorId,
    staffId,
    patientId,
    status = "Active",
    departmentId,
    shift,
  } = req.query;

  const filter = { hospital: hospitalId };
  
  if (assignmentType) filter.assignmentType = assignmentType;
  if (doctorId) filter.doctors = doctorId;
  if (staffId) filter.staff = staffId;
  if (patientId) filter.patients = patientId;
  if (status) filter.status = status;
  if (departmentId) filter.department = departmentId;
  if (shift) filter.shift = shift;

  req.assignmentFilters = filter;
  next();
};

export const handlePagination = (req, res, next) => {
  const { page = 1, limit = 10 } = req.query;
  const skip = (page - 1) * limit;

  req.pagination = {
    page: parseInt(page),
    limit: parseInt(limit),
    skip
  };

  next();
};