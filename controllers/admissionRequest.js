import AdmissionRequest from '../models/admissionReqModel.js';
import Bed from '../models/bedModel.js';
import Room from '../models/roomModel.js';
import Patient from '../models/patientModel.js';
import Consultation from '../models/consultationModel.js';

export const createAdmissionRequest = async (req, res) => {
  try {
    const hospitalId = req.session.hospitalId;
    if (!hospitalId) {
      return res.status(403).json({ message: "No hospital context found." });
    }

    const { patientPatId, doctor, sendTo, admissionDetails } = req.body;
    const createdBy = req.user._id;

    // 1. Validate patient using patId
    const patient = await Patient.findOne({ patId: patientPatId, hospital: hospitalId });
    if (!patient) {
      return res.status(404).json({ message: "Patient not found with given patId." });
    }

    // 2. Validate room by roomID
    const room = await Room.findOne({ roomID: admissionDetails.room, hospital: hospitalId });
    if (!room) {
      return res.status(404).json({ message: "Room not found with given roomId." });
    }

    // 3. Validate bed by bedNumber and associated room
    const bed = await Bed.findOne({
      bedNumber: admissionDetails.bed,
      hospital: hospitalId,
      room: room._id,
      status: 'Available'
    });
    if (!bed) {
      return res.status(404).json({ message: "Bed not found or not available with given bed number in the specified room." });
    }

    // 4. Prepare admissionDetails (convert admissionDate -> date)
    const admissionData = {
      ...admissionDetails,
      room: room._id,
      bed: bed._id,
      date: admissionDetails.admissionDate // Map to expected schema field
    };
    delete admissionData.admissionDate;

    // 5. Create the admission request
    const request = await AdmissionRequest.create({
      patient: patient._id,
      hospital: hospitalId,
      doctor,
      createdBy,
      sendTo,
      admissionDetails: admissionData
    });

    res.status(201).json({ message: "Admission request created successfully", request });

  } catch (error) {
    console.error("Create Admission Request Error:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};


export const approveAdmissionRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { role } = req.user;
    const { signature } = req.body;

    const admissionRequest = await AdmissionRequest.findById(requestId);
    if (!admissionRequest) {
      return res.status(404).json({ message: 'Admission request not found.' });
    }

    if (
      (role === 'doctor' && ['Doctor', 'Both'].includes(admissionRequest.sendTo)) ||
      (role === 'hospitalAdmin' && ['Admin', 'Both'].includes(admissionRequest.sendTo)) // NOTE: sendTo uses "Admin"
    ) {
      // Update approval object correctly
      if (role === 'doctor') {
        admissionRequest.approval.doctor = {
          approved: true,
          signature,
          approvedAt: new Date()
        };
      }

      if (role === 'hospitalAdmin') {
        admissionRequest.approval.admin = {
          approved: true,
          signature,
          approvedAt: new Date()
        };
      }

      // Check if status should be marked as Approved
      const isApproved =
        (admissionRequest.sendTo === 'Both' &&
          admissionRequest.approval.doctor?.approved &&
          admissionRequest.approval.admin?.approved) ||
        (admissionRequest.sendTo === 'Doctor' && admissionRequest.approval.doctor?.approved) ||
        (admissionRequest.sendTo === 'Admin' && admissionRequest.approval.admin?.approved);

      if (isApproved) {
        admissionRequest.status = 'Approved';
      }

      await admissionRequest.save();

      return res.status(200).json({
        message: `Admission request ${role} approval successful.`,
        status: admissionRequest.status,
        approval: admissionRequest.approval,
      });
    } else {
      return res.status(403).json({ message: 'Not authorized to approve this request.' });
    }
  } catch (error) {
    console.error('Error approving admission request:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};



export const admitPatient = async (req, res) => {
  const session = await AdmissionRequest.startSession();
  session.startTransaction();

  try {
    const { requestId } = req.params;

    const admissionRequest = await AdmissionRequest.findById(requestId)
      .populate('patient')
      .populate('admissionDetails.bed')
      .populate('admissionDetails.room')
      .session(session);

    if (!admissionRequest) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Admission request not found.' });
    }

    if (admissionRequest.status !== 'Approved') {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Admission request is not yet approved.' });
    }

    const roomId = admissionRequest.admissionDetails.room;
    const bedId = admissionRequest.admissionDetails.bed;

    if (!roomId || !bedId) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Room or bed reference missing in admission details.' });
    }

    const room = await Room.findById(roomId).session(session);
    const bed = await Bed.findById(bedId).session(session);

    if (!room) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Room not found.' });
    }

    if (!bed || !['Available', 'Reserved'].includes(bed.status)) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Bed is not available or reserved.' });
    }

    // Update patient admission status
    await Patient.findByIdAndUpdate(admissionRequest.patient._id, {
      admissionStatus: 'Admitted'
    }, { session });

    // Assign bed
    bed.status = 'Occupied';
    bed.assignedPatient = admissionRequest.patient._id;
    bed.assignedDate = new Date();
    await bed.save({ session });

    // Update room status
    await room.updateAvailableBeds();

    // Finalize admission
    admissionRequest.status = 'Admitted';
    await admissionRequest.save({ session });

    await session.commitTransaction();

    res.status(200).json({
      message: 'Patient successfully admitted.',
      admissionRequestId: admissionRequest._id,
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Error admitting patient:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  } finally {
    session.endSession();
  }
};

export const getAdmissionRequests = async (req, res) => {
  try {
    const hospitalId = req.session.hospitalId;
    if (!hospitalId) {
      return res.status(403).json({ message: "No hospital context found." });
    }

    const statusFilter = req.query.status;

    const filter = {
      hospital: hospitalId,
    };

    if (statusFilter && statusFilter !== "all" && statusFilter !== "") {
      filter.status = statusFilter;
    }

    const requests = await AdmissionRequest.find(filter)
      .populate({
        path: "patient",
        select: "name age contact admissionStatus",
        match: { admissionStatus: { $ne: "Admitted" } }, // 💥 exclude admitted patients
      })
      .populate("doctor", "name email")
      .populate("admissionDetails.room", "name roomType")
      .populate("admissionDetails.bed", "bedNumber bedType status");

    // Filter out null patients (those who were excluded by match)
    const filteredRequests = requests.filter(r => r.patient !== null);

    res.status(200).json({
      message: "Admission requests fetched successfully.",
      count: filteredRequests.length,
      requests: filteredRequests,
    });
  } catch (error) {
    console.error("Error fetching admission requests:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

export const getApprovedAdmissions = async (req, res) => {
  try {
    const hospitalId = req.session.hospitalId;
    if (!hospitalId) return res.status(403).json({ message: "No hospital context found." });

    const approvedRequests = await AdmissionRequest.find({
      hospital: hospitalId,
      status: 'Approved',
    })
      .populate("patient", "name age contact admissionStatus")
      .populate("doctor", "name email")
      .populate("admissionDetails.room", "name roomType")
      .populate("admissionDetails.bed", "bedNumber bedType status");

    res.status(200).json({
      message: "Approved admission requests fetched successfully.",
      count: approvedRequests.length,
      requests: approvedRequests,
    });
  } catch (error) {
    console.error("Error fetching approved admissions:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

export const getAdmittedPatients = async (req, res) => {
  try {
    const hospitalId = req.session.hospitalId;
    if (!hospitalId) {
      return res.status(403).json({ message: "No hospital context found." });
    }

    // 1. Get all admitted patients
    const admitted = await Patient.find({
      hospital: hospitalId,
      admissionStatus: "Admitted"
    }).select("name age gender contact admissionStatus");

    const admittedMap = {};
    admitted.forEach(p => {
      admittedMap[p._id.toString()] = { ...p.toObject(), type: "admitted" };
    });

    // 2. Get patients with follow-up consultations
    const followUpConsultations = await Consultation.find({
      followUpRequired: true
    }).select("patient");

    const followUpPatientIds = [...new Set(
      followUpConsultations.map(c => c.patient.toString())
    )];

    // 3. Get those patients from DB
    const followUpPatients = await Patient.find({
      hospital: hospitalId,
      _id: { $in: followUpPatientIds }
    }).select("name age gender contact admissionStatus");

    // 4. Merge results and tag
    const patientMap = { ...admittedMap };

    followUpPatients.forEach(p => {
      const id = p._id.toString();
      if (patientMap[id]) {
        patientMap[id].type = "admitted+followup";
      } else {
        patientMap[id] = { ...p.toObject(), type: "followup" };
      }
    });

    const finalPatients = Object.values(patientMap);

    res.status(200).json({
      message: "Admitted and follow-up patients fetched successfully.",
      count: finalPatients.length,
      patients: finalPatients
    });
  } catch (error) {
    console.error("Error fetching tracked patients:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};



