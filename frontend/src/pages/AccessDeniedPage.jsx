import { useLocation, useNavigate } from "react-router-dom";
import Layout from "../components/Layout";

const AccessDeniedPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const fromPath = location.state?.from || "this page";

  return (
    <Layout title="Access Denied">
      <section className="editor-card">
        <div className="editor-head compact">
          <div>
            <p className="hero-eyebrow">Permission Check</p>
            <h3>You do not have access to this section</h3>
          </div>
        </div>

        <div className="invoice-view-body">
          <p className="invoice-meta-row">
            Your current role does not allow opening {fromPath}. If you need this permission, contact owner admin.
          </p>

          <div className="editor-actions">
            <button type="button" className="ghost-btn" onClick={() => navigate(-1)}>
              Go Back
            </button>
            <button type="button" className="primary-btn" onClick={() => navigate("/")}>
              Go To Dashboard
            </button>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default AccessDeniedPage;
