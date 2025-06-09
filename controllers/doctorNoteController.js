import DoctorNote from '../models/DoctorNoteModel.js';

export const createDoctorNote = async (req, res) => {
  try {
    const { note, patientId } = req.body;

    const doctorId = req.user._id;
    const hospitalId = req.session.hospitalId;

    if (!note) {
      return res.status(400).json({ message: 'Note content is required.' });
    }

    const newNote = new DoctorNote({
      doctor: doctorId,
      patient: patientId || null,
      note,
      hospital: hospitalId,
    });

    await newNote.save();

    res.status(201).json({
      message: 'Doctor note created successfully.',
      data: newNote,
    });
  } catch (error) {
    console.error('Error creating doctor note:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
};

export const getDoctorNotes = async (req, res) => {
  try {
    const notes = await DoctorNote.find()
      .populate({
        path: 'doctor',
        select: 'name email specialization phone'
      })
      .populate({
        path: 'patient',
        select: 'name email phone age'
      })
      .populate({
        path: 'hospital',
        select: 'name phone email address'
      });

    res.status(200).json(notes);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch notes' });
  }
};
