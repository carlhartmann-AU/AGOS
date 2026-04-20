function App() {
  const [route, setRoute] = React.useState(() => (location.hash.replace("#","") || "home"));
  React.useEffect(() => {
    const on = () => setRoute(location.hash.replace("#","") || "home");
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const go = (k) => { location.hash = k; window.scrollTo({top:0,behavior:"smooth"}); };

  let page = <Home go={go}/>;
  if (route==="features") page = <Features go={go}/>;
  else if (route==="integrations") page = <IntegrationsPage go={go}/>;
  else if (route==="pricing") page = <Pricing go={go}/>;
  else if (route==="compare") page = <Compare go={go}/>;
  else if (route==="usecases") page = <UseCases go={go}/>;
  else if (route==="docs") page = <Docs go={go}/>;
  else if (route==="security") page = <Security go={go}/>;

  return (
    <>
      <Nav route={route} go={go}/>
      <main>{page}</main>
      <Footer go={go}/>
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
