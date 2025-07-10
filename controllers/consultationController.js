import Consultation from "../models/consultationModel.js";
import Appointment from "../models/appointmentModel.js";
import Department from "../models/departmentModel.js";
import Hospital from "../models/hospitalModel.js";

export const submitConsultation = async (req, res) => {
  const session = await Consultation.startSession();
  session.startTransaction();

  try {
    const hospitalId = req.session.hospitalId;
    const { doctor, patient, appointment, department, consultationData, action } = req.body;

    // Validation
    if (!hospitalId) {
      return res.status(403).json({ message: "Access denied. No hospital context found." });
    }

    if (!doctor || !patient || !appointment || !department || !consultationData || !action) {
      return res.status(400).json({ message: "All fields including action are required." });
    }

    if (!["complete", "final", "refer"].includes(action)) {
      return res.status(400).json({ message: "Invalid action type." });
    }

    // Verify hospital and department
    const hospital = await Hospital.findById(hospitalId).session(session);
    if (!hospital) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Hospital not found." });
    }

    const departmentExists = await Department.findOne({ _id: department, hospital: hospitalId }).session(session);
    if (!departmentExists) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Department not found in this hospital." });
    }

    // Prepare consultation status and follow-up logic
    let status = "completed";
    let followUpRequired = false;

    if (action === "complete") {
      followUpRequired = true;
    } else if (action === "refer") {
      status = "referred";
    }

    // Create consultation
    const newConsultation = await Consultation.create(
      [{
        doctor,
        patient,
        appointment,
        department,
        consultationData,
        status,
        followUpRequired
      }],
      { session }
    );

    // Update appointment status
    await Appointment.findByIdAndUpdate(
      appointment,
      { status: "completed" },
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      message: "Consultation submitted successfully.",
      consultation: newConsultation[0]
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error submitting consultation:", error);
    res.status(500).json({ message: "Error submitting consultation.", error: error.message });
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

export const getMostCommonDiagnoses = async (req, res) => {
  const hospitalId = req.session.hospitalId;

  if (!hospitalId) {
    return res.status(403).json({ message: 'No hospital context found.' });
  }

  const thisYearStart = new Date(new Date().getFullYear(), 0, 1);

  try {
    const result = await Consultation.aggregate([
      {
        $match: {
          department: { $exists: true },
          date: { $gte: thisYearStart },
          'consultationData.diagnosis': { $exists: true, $ne: null }
        }
      },
      {
        $facet: {
          topDiagnoses: [
            {
              $group: {
                _id: '$consultationData.diagnosis',
                count: { $sum: 1 }
              }
            },
            { $sort: { count: -1 } },
            { $limit: 5 }
          ],
          totalCount: [
            {
              $group: {
                _id: '$consultationData.diagnosis'
              }
            },
            {
              $count: 'total'
            }
          ]
        }
      }
    ]);

    const topDiagnoses = result[0].topDiagnoses.map(item => ({
      diagnosis: item._id,
      count: item.count
    }));

    const total = result[0].totalCount[0]?.total || 0;

    res.status(200).json({
      success: true,
      totalDiagnoses: total,
      data: topDiagnoses
    });

  } catch (error) {
    res.status(500).json({ message: 'Server error.', error });
  }
};
