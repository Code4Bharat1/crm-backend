import ExpenseClaim from '../models/ExpenseClaim.js';
import Employee from '../models/Employee.js';

export const getExpenseClaims = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { claimId: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } },
        { project: { $regex: search, $options: 'i' } },
        { status: { $regex: search, $options: 'i' } }
      ];
      // Note: searching by employeeName would require an aggregation or a separate lookup
    }

    const limitNum = parseInt(limit, 10);
    const skip = (parseInt(page, 10) - 1) * limitNum;

    const claims = await ExpenseClaim.find(query)
      .populate('employeeId', 'fullName')
      .skip(skip)
      .limit(limitNum)
      .sort({ createdAt: -1 });

    const total = await ExpenseClaim.countDocuments(query);

    res.json({
      success: true,
      data: {
        claims,
        pagination: { page: parseInt(page, 10), limit: limitNum, total, totalPages: Math.ceil(total / limitNum) }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const exportExpenseClaims = async (req, res) => {
  try {
    const claims = await ExpenseClaim.find().populate('employeeId', 'fullName').sort({ createdAt: -1 });
    let csvStr = "Claim ID,Employee,Date,Category,Amount,Project,Status\n";
    claims.forEach(c => {
      csvStr += `"${c.claimId}","${c.employeeId ? c.employeeId.fullName : 'Unknown'}","${c.date}","${c.category}",${c.amount},"${c.project}","${c.status}"\n`;
    });
    res.header('Content-Type', 'text/csv');
    res.attachment('expense_claims.csv');
    res.send(csvStr);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
