import mongoose from "mongoose";
import moment from "moment";
import Appointment from "../models/appointmentModel.js";
import RejectedAppointment from "../models/rejectedAppointmentModel.js";

export const getYearlyData = async (baseFilter, targetYear) => {
  const year = targetYear ? parseInt(targetYear) : new Date().getFullYear();

  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31, 23, 59, 59);

  const dateFilter = {
    ...baseFilter,
    tokenDate: { $gte: startDate, $lte: endDate },
  };

  const [allAppointments, rejectedAppointments] = await Promise.all([
    Appointment.find(dateFilter).select("tokenDate status"),
    RejectedAppointment.find(dateFilter).select("tokenDate status"),
  ]);

  const appointments = [
    ...allAppointments.map((apt) => ({
      tokenDate: apt.tokenDate,
      status: apt.status.toLowerCase(),
    })),
    ...rejectedAppointments.map((apt) => ({
      tokenDate: apt.tokenDate,
      status: apt.status.toLowerCase(),
    })),
  ];

  console.log(
    `📊 YEARLY: Found ${appointments.length} total appointments for ${year}`
  );

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const months = monthNames.map((name, index) => {
    const monthStart = new Date(year, index, 1);
    const monthEnd = new Date(year, index + 1, 0, 23, 59, 59);

    const monthAppointments = appointments.filter(
      (apt) => apt.tokenDate >= monthStart && apt.tokenDate <= monthEnd
    );

    const scheduled = monthAppointments.filter(
      (apt) => apt.status === "scheduled"
    ).length;
    const ongoing = monthAppointments.filter(
      (apt) => apt.status === "ongoing"
    ).length;
    const waiting = monthAppointments.filter(
      (apt) => apt.status === "waiting"
    ).length;
    const completed = monthAppointments.filter(
      (apt) => apt.status === "completed"
    ).length;
    const rejected = monthAppointments.filter(
      (apt) => apt.status === "rejected"
    ).length;
    const cancelled = monthAppointments.filter(
      (apt) => apt.status === "cancelled"
    ).length;

    return {
      name,
      month: index + 1,
      total: monthAppointments.length,
      scheduled,
      ongoing,
      waiting,
      completed,
      rejected,
      cancelled,
    };
  });

  return {
    filterType: "yearly",
    year,
    summary: {
      total: appointments.length,
      scheduled: appointments.filter((apt) => apt.status === "scheduled")
        .length,
      ongoing: appointments.filter((apt) => apt.status === "ongoing").length,
      waiting: appointments.filter((apt) => apt.status === "waiting").length,
      completed: appointments.filter((apt) => apt.status === "completed")
        .length,
      rejected: appointments.filter((apt) => apt.status === "rejected").length,
      cancelled: appointments.filter((apt) => apt.status === "cancelled")
        .length,
    },
    data: months,
  };
};

export const getMonthlyData = async (baseFilter, targetYear, targetMonth) => {
  const year = targetYear ? parseInt(targetYear) : new Date().getFullYear();
  const month = targetMonth ? parseInt(targetMonth) - 1 : new Date().getMonth();

  const startDate = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  const endDate = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));

  const dateFilter = {
    ...baseFilter,
    tokenDate: { $gte: startDate, $lte: endDate },
  };

  const [allAppointments, rejectedAppointments] = await Promise.all([
    Appointment.find(dateFilter).select("tokenDate status"),
    RejectedAppointment.find(dateFilter).select("tokenDate status"),
  ]);

  const appointments = [
    ...allAppointments.map((a) => ({
      tokenDate: a.tokenDate,
      status: a.status.toLowerCase(),
    })),
    ...rejectedAppointments.map((a) => ({
      tokenDate: a.tokenDate,
      status: a.status.toLowerCase(),
    })),
  ];

  console.log(
    `📊 MONTHLY: Found ${appointments.length} total appointments for ${year}-${
      month + 1
    }`
  );

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const currentDate = new Date(Date.UTC(year, month, day));

    const dayStart = new Date(year, month, day, 0, 0, 0, 0);
    const dayEnd = new Date(year, month, day, 23, 59, 59, 999);

    const dayAppointments = appointments.filter(
      (a) => a.tokenDate >= dayStart && a.tokenDate <= dayEnd
    );

    const statusCounts = {};
    [
      "scheduled",
      "ongoing",
      "waiting",
      "completed",
      "rejected",
      "cancelled",
    ].forEach((status) => {
      statusCounts[status] = dayAppointments.filter(
        (a) => a.status === status
      ).length;
    });

    days.push({
      date: formatDateToYYYYMMDD(new Date(year, month, day)),
      day: day,
      dayName: currentDate.toLocaleDateString("en-US", { weekday: "short" }),
      total: dayAppointments.length,
      ...statusCounts,
    });
  }

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  return {
    filterType: "monthly",
    year,
    month: month + 1,
    monthName: monthNames[month],
    summary: {
      total: appointments.length,
      scheduled: appointments.filter((a) => a.status === "scheduled").length,
      ongoing: appointments.filter((a) => a.status === "ongoing").length,
      waiting: appointments.filter((a) => a.status === "waiting").length,
      completed: appointments.filter((a) => a.status === "completed").length,
      rejected: appointments.filter((a) => a.status === "rejected").length,
      cancelled: appointments.filter((a) => a.status === "cancelled").length,
    },
    data: days,
  };
};

const formatDateToYYYYMMDD = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const getWeeklyData = async (baseFilter, targetWeek) => {
  let startOfWeek, endOfWeek;

  if (targetWeek) {
    startOfWeek = moment(targetWeek).startOf("isoWeek");
    endOfWeek = moment(targetWeek).endOf("isoWeek");
  } else {
    startOfWeek = moment().startOf("isoWeek");
    endOfWeek = moment().endOf("isoWeek");
  }

  const dateFilter = {
    ...baseFilter,
    tokenDate: {
      $gte: startOfWeek.toDate(),
      $lte: endOfWeek.toDate(),
    },
  };

  const [allAppointments, rejectedAppointments] = await Promise.all([
    Appointment.find(dateFilter).select("tokenDate status"),
    RejectedAppointment.find(dateFilter).select("tokenDate status"),
  ]);

  const appointments = [
    ...allAppointments.map((apt) => ({
      tokenDate: apt.tokenDate,
      status: apt.status.toLowerCase(),
    })),
    ...rejectedAppointments.map((apt) => ({
      tokenDate: apt.tokenDate,
      status: apt.status.toLowerCase(),
    })),
  ];

  console.log(
    `📊 WEEKLY: Found ${
      appointments.length
    } total appointments for week ${startOfWeek.format("YYYY-MM-DD")}`
  );

  const weekdays = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];
  const days = [];

  for (let i = 0; i < 7; i++) {
    const currentDay = startOfWeek.clone().add(i, "days");
    const dayStart = currentDay.startOf("day").toDate();
    const dayEnd = currentDay.endOf("day").toDate();

    const dayAppointments = appointments.filter(
      (apt) => apt.tokenDate >= dayStart && apt.tokenDate <= dayEnd
    );

    const scheduled = dayAppointments.filter(
      (apt) => apt.status === "scheduled"
    ).length;
    const ongoing = dayAppointments.filter(
      (apt) => apt.status === "ongoing"
    ).length;
    const waiting = dayAppointments.filter(
      (apt) => apt.status === "waiting"
    ).length;
    const completed = dayAppointments.filter(
      (apt) => apt.status === "completed"
    ).length;
    const rejected = dayAppointments.filter(
      (apt) => apt.status === "rejected"
    ).length;
    const cancelled = dayAppointments.filter(
      (apt) => apt.status === "cancelled"
    ).length;

    days.push({
      date: currentDay.format("YYYY-MM-DD"),
      dayName: weekdays[i],
      total: dayAppointments.length,
      scheduled,
      ongoing,
      waiting,
      completed,
      rejected,
      cancelled,
    });
  }

  return {
    filterType: "weekly",
    weekStart: startOfWeek.format("YYYY-MM-DD"),
    weekEnd: endOfWeek.format("YYYY-MM-DD"),
    summary: {
      total: appointments.length,
      scheduled: appointments.filter((apt) => apt.status === "scheduled")
        .length,
      ongoing: appointments.filter((apt) => apt.status === "ongoing").length,
      waiting: appointments.filter((apt) => apt.status === "waiting").length,
      completed: appointments.filter((apt) => apt.status === "completed")
        .length,
      rejected: appointments.filter((apt) => apt.status === "rejected").length,
      cancelled: appointments.filter((apt) => apt.status === "cancelled")
        .length,
    },
    data: days,
  };
};
