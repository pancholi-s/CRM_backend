import express from "express"
import {getPatientsByHospital} from "../controllers/patientController.js"

const router= express.Router()

router.get("/getPatientsByHospital",getPatientsByHospital)

export default router