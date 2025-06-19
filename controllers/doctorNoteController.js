import DoctorNote from "../models/DoctorNoteModel.js";

export const createDoctorNote = async (req, res) => {
  try {
    const { note, patientId } = req.body;

    const doctorId = req.user._id;
    const hospitalId = req.session.hospitalId;

    if (!note) {
      return res.status(400).json({ message: "Note content is required." });
    }

    const newNote = new DoctorNote({
      doctor: doctorId,
      patient: patientId || null,
      note,
      hospital: hospitalId,
    });

    await newNote.save();

    res.status(201).json({
      message: "Doctor note created successfully.",
      data: newNote,
    });
  } catch (error) {
    console.error("Error creating doctor note:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

export const getDoctorNotes = async (req, res) => {
  try {
    const notes = await DoctorNote.find()
      .populate({
        path: "doctor",
        select: "name email phone",
      })

      .populate({
        path: "patient",
        select: "name email phone age",
      });

    const simplifiedNotes = notes.map((note) => ({
      _id: note._id,
      note: note.note,
      date: note.date,
      doctor: note.doctor
        ? {
            name: note.doctor.name,
            email: note.doctor.email,
            phone: note.doctor.phone,
          }
        : null,
      patient: note.patient
        ? {
            name: note.patient.name,
            email: note.patient.email,
            phone: note.patient.phone,
            age: note.patient.age,
          }
        : null,
    }));

    res.status(200).json(simplifiedNotes);
  } catch (error) {
    console.error("Error fetching doctor notes:", error);
    res.status(500).json({ message: "Failed to fetch notes" });
  }
};
