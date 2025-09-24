import React from 'react';
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';
import MartyrRegistration from './pages/MartyrRegistration';
import InjuryRegistration from './pages/InjuryRegistration';
import InjuriesManagement from './pages/admin/InjuriesManagement';
import DashboardLayout from './components/layout/DashboardLayout';

const App = () => {
  return (
    <Router>
      <DashboardLayout>
        <Switch>
          <Route path="/register-martyr" component={MartyrRegistration} />
          <Route path="/register-injury" component={InjuryRegistration} />
          <Route path="/admin/injuries" component={InjuriesManagement} />
        </Switch>
      </DashboardLayout>
    </Router>
  );
};

export default App;