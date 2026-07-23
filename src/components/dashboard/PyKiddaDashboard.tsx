import { learningCards } from "./dashboardData";

export default function PyKiddaDashboard() {

  return (

    <main className="py-kidda-dashboard">

      <section className="py-kidda-temporary-check">

        <div>

          <p>PY Kidda</p>

          <h1>Dashboard foundation is connected</h1>

          <p>

            The complete hero and animated sections will be added in the

            following implementation parts.

          </p>

          <p>

            Learning cards prepared:{" "}

            <strong>{learningCards.length}</strong>

          </p>

        </div>

      </section>

    </main>

  );

}
