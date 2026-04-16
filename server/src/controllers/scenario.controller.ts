import { Request, Response, NextFunction } from 'express';
import { Scenario } from '../models';

export async function getScenarios(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const scenarios = await Scenario.find()
      .select('name description gameType productNames rm1Name rm2Name');

    res.status(200).json({ success: true, data: { scenarios } });
  } catch (err) {
    next(err);
  }
}

export async function getScenarioByName(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const scenario = await Scenario.findOne({
      name: { $regex: new RegExp(`^${req.params.name}$`, 'i') },
    });

    if (!scenario) {
      res.status(404).json({ success: false, message: 'Scenario not found' });
      return;
    }

    res.status(200).json({ success: true, data: { scenario } });
  } catch (err) {
    next(err);
  }
}

export async function createScenario(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const existing = await Scenario.findOne({ name: req.body.name });
    if (existing) {
      res.status(409).json({ success: false, message: 'Scenario name already taken' });
      return;
    }

    const scenario = await Scenario.create(req.body);
    res.status(201).json({ success: true, data: { scenario } });
  } catch (err) {
    next(err);
  }
}
