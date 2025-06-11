import Consultation from '../models/consultationModel.js';
import Department from '../models/departmentModel.js';
import Hospital from '../models/hospitalModel.js';

export const createConsultation = async (req, res) => {
  console.log("Session Hospital ID:", req.session.hospitalId);
  console.log("Request Body:", req.body);
  
  const session = await Consultation.startSession();
  session.startTransaction();

  try {
    const hospitalId = req.session.hospitalId; // Access hospitalId from session
    const { doctor, patient, appointment, department, consultationData } = req.body;

    // Validate hospital context
    if (!hospitalId) {
      return res.status(403).json({ message: 'Access denied. No hospital context found.' });
    }

    // Validate required fields
    if (!doctor || !patient || !appointment || !department || !consultationData) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    // Check if hospital exists
    const hospital = await Hospital.findById(hospitalId).session(session);
    if (!hospital) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Hospital not found.' });
    }

    // Check if department belongs to hospital
    const departmentExists = await Department.findOne({ _id: department, hospital: hospitalId }).session(session);
    if (!departmentExists) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Department not found in this hospital.' });
    }

    // Create new consultation
    const newConsultation = await Consultation.create(
      [{
        doctor,
        patient,
        appointment,
        department,
        consultationData
      }],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      message: 'Consultation created successfully.',
      consultation: newConsultation[0]
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Error creating consultation:', error);
    res.status(500).json({ message: 'Error creating consultation.', error: error.message });
  }
  
};


export const getConsultationByAppointment = async (req, res) => {
  try {
    const hospitalId = req.session.hospitalId;
    const { appointmentId } = req.params;

    if (!hospitalId) {
      return res.status(400).json({ message: 'Hospital context not found in session.' });
    }

    const consultation = await Consultation.findOne({ appointment: appointmentId })
      .populate('doctor', 'name')
      .populate('patient', 'name')
      .populate('department', 'name');

    if (!consultation) {
      return res.status(404).json({ message: 'Consultation not found for this appointment.' });
    }

    res.status(200).json({
      message: 'Consultation retrieved successfully.',
      consultation
    });

  } catch (error) {
    console.error('Error fetching consultation:', error);
    res.status(500).json({ message: 'Error fetching consultation.' });
  }
};

export const getPatientConsultationHistory = async (req, res) => {
  try {
    const hospitalId = req.session.hospitalId;
    const { patientId } = req.params;
    const { departmentId } = req.query; // Optional filter for department

    if (!hospitalId) {
      return res.status(400).json({ message: 'Hospital context not found in session.' });
    }

    const filter = { patient: patientId };
    if (departmentId) {
      filter.department = departmentId;
    }

    const consultations = await Consultation.find(filter)
      .select('consultationData date doctor department') // All sections
      .populate('department', 'name')
      .populate('doctor', 'name');

    if (!consultations.length) {
      return res.status(404).json({ message: 'No consultations found for this patient.' });
    }

    const history = consultations.map(cons => ({
      department: cons.department.name,
      doctor: cons.doctor.name,
      date: cons.date,
      consultationData: cons.consultationData
    }));

    res.status(200).json({
      message: 'Full consultation history retrieved successfully.',
      count: history.length,
      history
    });

  } catch (error) {
    console.error('Error fetching consultation history:', error);
    res.status(500).json({ message: 'Error fetching consultation history.' });
  }
};
